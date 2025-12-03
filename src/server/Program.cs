using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Google.Apis.Auth;
using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Net.Http.Json;
using Library;
using Library.Storage;
using static Library.JWTMethods;
using System.Text.Json.Serialization;
using Amazon.S3;
using Amazon.S3.Model;
using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authentication.JwtBearer;


#region Constants
//NEW: allow Vite dev (5173) to call the API
const string CorsPolicy = "BarterCors";
#endregion

Startup.print_startup_message();

#region Builder Steps
var builder = WebApplication.CreateBuilder( args );

// Adding Swagger Docs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen( context => {
    context.SwaggerDoc( "v1", new OpenApiInfo { Title = "Bartering API", Description = "Trading like crazy idk", Version = "v1" } );
});

// DB context as you had it
builder.Services.AddDbContext<Library.Storage.Database>();

//register CORS (dev origin)
builder.Services.AddCors( origin => {
    origin.AddPolicy( CorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials()
    );
});

var seaweed = new Seaweed(
    "http://seaweed:8333",
    "barter_access",
    "barter_secret",
    "barter"
);

builder.Services.AddSingleton( seaweed );

// Ensure bucket exists
var ( client, bucket ) = Library.StorageMethods.GetClientAndBucket( seaweed );
var response = await client.ListBucketsAsync();
var buckets = response?.Buckets ?? new List<S3Bucket>();

if ( !buckets.Any( buck => buck.BucketName == bucket ) ) await client.PutBucketAsync( new PutBucketRequest { BucketName = bucket } );

#endregion

// Sessions
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(12);
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.None; 
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.IsEssential = true;
});
var jwtSecret = builder.Configuration["Jwt:Secret"];
// JWT bearer
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();

// enabling swagger for development environment only
if ( app.Environment.IsDevelopment() ) {
   app.UseSwagger();
   app.UseSwaggerUI( context => { context.SwaggerEndpoint( "/swagger/v1/swagger.json", "Bartering API V1" ); } );
}

//enable CORS before endpoints
app.UseCors(CorsPolicy);
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet( "/", () => "Hello World!" );

#region User Debug Routes
// DEBUG ROUTES
app.MapGet( "debug/dump/users", async ( [FromServices] Database database ) => {
  var users = await database.Users.ToListAsync();
  return Results.Json( users );
});

app.MapDelete( "debug/delete/user", async ( [FromServices] Database database, [FromBody] DeleteUserRequest request ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
  if ( user is null ) return Results.BadRequest( "Invalid credentials." );
  database.Users.Remove( user );
  await database.SaveChangesAsync();
  return Results.Ok( "Account Removed." );
});

#endregion


app.MapGet( "get/user/by/id/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
    var user = await database.Users.FindAsync( id );
    if ( user is null ) return Results.NotFound( "User not found." );
    return Results.Ok( user );
});

app.MapGet( "get/user/by/email/{email}", async ( [FromServices] Database database, string email ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == email );
    if ( user is null ) return Results.NotFound( "User not found." );
    return Results.Ok( user );
});

#region Item Routes
// Item Routes
app.MapPost( "create/item", async ( [FromServices] Database database, [FromBody] CreateItemRequest request ) => {
  if ( string.IsNullOrWhiteSpace( request.Category ) || !Enum.TryParse<Category>( request.Category, true, out var category_enum ) ) {
    return Results.BadRequest( "Invalid category." );
  }

  var item = new Item {
    ID = Guid.NewGuid(),
    OwnerID = request.OwnerID,
    Name = request.Name,
    Description = request.Description,
    Category = category_enum,
    Images = new List<Image>()
  };

  if ( request.ImageKeys is { Length: > 0 } ) {
    var sanitized = request.ImageKeys
      .Where( key => !string.IsNullOrWhiteSpace( key ) )
      .Distinct()
      .Select( key => new Image {
        ID = Guid.NewGuid(),
        ItemID = item.ID,
        Key = key!.Trim()
      })
      .ToList();

    item.Images = sanitized;
  }

  database.Items.Add( item );
  await database.SaveChangesAsync();
  await database.Entry( item ).Collection( i => i.Images ).LoadAsync();

  return Results.Ok( ShapeItem( item ) );
});

app.MapPatch( "update/item", async ( [FromServices] Database database, [FromBody] UpdateItemRequest request ) => {
  if ( string.IsNullOrWhiteSpace( request.Category ) || !Enum.TryParse<Category>( request.Category, true, out var category_enum ) ) {
    return Results.BadRequest( "Invalid category." );
  }

  var item = await database.Items.Include( i => i.Images ).SingleOrDefaultAsync( i => i.ID == request.ID );
  if ( item is null ) return Results.NotFound( "Item not found." );
  
  Console.WriteLine( $"PATCH item[{ item.ID }] : { item.Name } -> { request.Name }, { item.Description } -> { request.Description }, { item.Category } -> { category_enum }");
  item.Name = request.Name;
  item.Description = request.Description;
  item.Category = category_enum;

  if ( request.ImageKeys is not null ) {
    item.Images ??= new List<Image>();
    if ( item.Images.Any() ) database.Images.RemoveRange( item.Images );

    item.Images = request.ImageKeys
      .Where( key => !string.IsNullOrWhiteSpace( key ) )
      .Distinct()
      .Select( key => new Image {
        ID = Guid.NewGuid(),
        ItemID = item.ID,
        Key = key!.Trim()
      })
      .ToList();
  }

  database.Items.Update( item );
  await database.SaveChangesAsync();
  await database.Entry( item ).Collection( i => i.Images ).LoadAsync();
  return Results.Ok( ShapeItem( item ) );
});

app.MapGet( "get/items/by/owner/{owner_id:guid}", async ( [FromServices] Database database, Guid owner_id ) => {
  var items = await database.Items
    .Where( item => item.OwnerID == owner_id )
    .Include( item => item.Images )
    .ToListAsync();
  return Results.Ok( items.Select( ShapeItem ) );
});

app.MapGet( "get/items", async ( [FromServices] Database database ) => {
  var items = await database.Items.Include( item => item.Images ).ToListAsync();
  return Results.Ok( items.Select( ShapeItem ) );
});

app.MapGet( "get/item/by/id/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
  var item = await database.Items.Include( entry => entry.Images ).SingleOrDefaultAsync( entry => entry.ID == id ); 
  if ( item is null ) return Results.NotFound( "Item not found." );
  return Results.Ok( ShapeItem( item ) );
});

// debug routes
app.MapGet( "debug/dump/items", async ( [FromServices] Database database ) => {
  var items = await database.Items.ToListAsync();
  return Results.Json( items );
});

app.MapDelete( "delete/item/{id:guid}", async ( [FromServices] Database database, Guid id, [FromQuery] Guid ownerId ) => {
  var item = await database.Items.Include( entry => entry.Images ).SingleOrDefaultAsync( entry => entry.ID == id );
  if ( item is null ) return Results.NotFound( "Item not found." );
  if ( item.OwnerID != ownerId ) return Results.Forbid();

  database.Items.Remove( item );
  await database.SaveChangesAsync();
  return Results.Ok( "Item removed." );
});

#endregion Item Routes

#region Seaweed Image Routes
// Seaweed Image Routes
app.MapPost( "create/image", async ( HttpRequest request, [FromServices] Seaweed seaweed ) => {
    if ( !request.HasFormContentType ) return Results.BadRequest( "Invalid form data." );

    var form = await request.ReadFormAsync();
    var file = form.Files["file"];
    if ( file is null || file.Length == 0 ) return Results.BadRequest( "No file uploaded." );

    var key = Guid.NewGuid().ToString();

    await using var stream = file.OpenReadStream();
    await seaweed.Upload( key, stream, file.ContentType );

    return Results.Ok( new { Key = key } );
});

app.MapGet( "get/image/{key}", async ( string key, [FromServices] Seaweed seaweed ) => {
    try {
        var ( image, content_type ) = await seaweed.Download( key );

        Console.WriteLine( $"GET  {bucket}: { key } -> { content_type }" );

        return Results.File( image, content_type );
    }
    catch ( AmazonS3Exception error ) when ( error.StatusCode == System.Net.HttpStatusCode.NotFound ) {
        return Results.NotFound( "Image not found." );
    }
});

app.MapDelete( "debug/delete/image/{key}", async ( string key, [FromServices] Seaweed seaweed ) => {
    var ( client, bucket ) = Library.StorageMethods.GetClientAndBucket( seaweed );

    await client.DeleteObjectAsync( bucket, key );
    return Results.Ok( $"Deleted image { key }" );
});


app.MapGet( "debug/dump/images", async ( [FromServices] Seaweed seaweed ) => {
    var ( client, bucket ) = Library.StorageMethods.GetClientAndBucket( seaweed );

    var response = await client.ListObjectsV2Async( new ListObjectsV2Request { BucketName = bucket } );
    var keys = response.S3Objects?.Select( obj => obj.Key ).ToArray() ?? Array.Empty<string>();

    return Results.Ok( keys );
});

#endregion


# region Trading Routes
app.MapPost( "create/trade", async ( [FromServices] Database database, [FromBody] CreateTradeRequest request ) => {
  // get each user
  var initiator = await database.Users.Include( user => user.Items ).FirstOrDefaultAsync( user => user.ID == request.Initiator );
  var receiver  = await database.Users.Include( user => user.Items ).FirstOrDefaultAsync( user => user.ID == request.Receiver );
  if (initiator is null || receiver is null) return Results.BadRequest( "Invalid user(s)." );


  // get their items
  var initiator_item_ids = initiator.Items.Select( item => item.ID ).ToHashSet();
  var receiver_item_ids  =  receiver.Items.Select( item => item.ID ).ToHashSet();

  // offerings must belong to initiating party
  if ( request.OfferingItems.Any( id => !initiator_item_ids.Contains( id ) ) ) return Results.BadRequest( "One or more offered items are not owned by the initiator." );

  // sought items must belong to receiving party
  if ( request.SeekingItems.Any( id  => !receiver_item_ids.Contains( id ) ) )  return Results.BadRequest( "One or more requested items are not owned by the receiver." );

  var trade = new Trade {
    ID = Guid.NewGuid(),
    InitiatorID = request.Initiator,
    ReceiverID = request.Receiver,
    OfferingItemIDs = request.OfferingItems,
    SeekingItemIDs = request.SeekingItems,
    Status = Status.Requested
  };

  database.Trades.Add( trade );
  await database.SaveChangesAsync();

  return Results.Ok(new {
    trade.ID,
    trade.InitiatorID,
    trade.ReceiverID,
    trade.OfferingItemIDs,
    trade.SeekingItemIDs,
    trade.Status
  });
});

app.MapPatch( "update/trade", async ( [FromServices] Database database, [FromBody] UpdateTradeRequest request ) => {
  if ( string.IsNullOrWhiteSpace( request.Status ) || !Enum.TryParse<Status>( request.Status, true, out var status_enum ) ) {
    return Results.BadRequest( "Invalid status." );
  }

  var trade = await database.Trades.FindAsync( request.ID );
  if ( trade is null ) return Results.NotFound( "Item not found." );
  
  Console.WriteLine( $"PATCH Trade[{ trade.ID }] : { trade.Status } -> { status_enum } | receiver == request : { trade.ReceiverID } == { request.Receiver }" );
  if ( request.Receiver != trade.ReceiverID ) return Results.BadRequest( "Only the receiving party can update." );

  trade.Status = status_enum;


  database.Trades.Update( trade );
  await database.SaveChangesAsync();
  return Results.Ok( trade );
});

app.MapGet( "get/trade/by/id/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
  var trade = await database.Trades.FindAsync( id ); 
  if ( trade is null ) return Results.NotFound( "Trade not found." );
  return Results.Ok( trade );
});

app.MapGet( "get/trades/by/receiver/{user_id:guid}", async ( [FromServices] Database database, Guid user_id ) => {
  var trades = await database.Trades.Where( item => item.ReceiverID == user_id ).ToListAsync();
  return Results.Ok( trades );
});

app.MapGet( "get/trades/by/initiator/{user_id:guid}", async ( [FromServices] Database database, Guid user_id ) => {
  var trades = await database.Trades.Where( item => item.InitiatorID == user_id ).ToListAsync();
  return Results.Ok( trades );
});

app.MapGet( "get/trades/pending/{user_id:guid}", async ( [FromServices] Database database, Guid user_id ) => {
  var trades = await database.Trades
    .Where( trade => trade.ReceiverID == user_id && ( trade.Status == Status.Requested || trade.Status == Status.Countered ) )
    .ToListAsync();

  var item_ids = trades.SelectMany( trade => trade.OfferingItemIDs.Concat( trade.SeekingItemIDs ) ).ToHashSet();
  var items = await database.Items
    .Include( item => item.Images )
    .Where( item => item_ids.Contains( item.ID ) )
    .ToListAsync();

  var shaped = trades.Select( trade => ShapeTrade( trade, items ) );
  return Results.Ok( shaped );
});

// debug routes
app.MapGet( "debug/dump/trades", async ( [FromServices] Database database ) => {
  var trades = await database.Trades.ToListAsync();
  return Results.Json( trades );
});

app.MapDelete( "debug/delete/trade/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
  var trade = await database.Trades.SingleOrDefaultAsync( trade => trade.ID == id );
  if ( trade is null ) return Results.BadRequest( "Invalid credentials." );
  database.Trades.Remove( trade );
  await database.SaveChangesAsync();
  return Results.Ok( "Trade Removed." );
});
#endregion


#region Authentication Routes
// Authentication Routes
app.MapPost( "/authentication/sign/up", async ( [FromServices] Database database, SignUpRequest request ) => {
  if ( await database.Users.AnyAsync( user => user.Email == request.Email ) ) return Results.BadRequest("Email already registered.");

  // Hash password (your current approach: SHA256(password + salt))
  var salt = Convert.ToBase64String( RandomNumberGenerator.GetBytes( 16 ) );
  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + salt ) ) );

  var user = new User { ID = Guid.NewGuid(), Email = request.Email, PasswordSalt = salt, PasswordHash = hash };

  database.Users.Add( user );

  await database.SaveChangesAsync();

  return Results.Ok( "Account created." );
});


app.MapPost("/authentication/google", async (
    [FromServices] Database database,
    [FromServices] IConfiguration config,
    HttpRequest http,
    HttpContext ctx
) =>
{
    // Read the incoming body (either { idToken } or { code })
    var payload = await JsonSerializer.DeserializeAsync<JsonElement>(http.Body);

    string? idToken = null;

    // 1) Direct ID token from client (not used in your new code-client flow but kept for compatibility)
    if (payload.TryGetProperty("idToken", out var idEl))
    {
        idToken = idEl.GetString();
    }

    // 2) If ID token isn't provided, exchange "code" for tokens
    if (string.IsNullOrWhiteSpace(idToken) && payload.TryGetProperty("code", out var codeEl))
    {
        var code = codeEl.GetString();
        if (string.IsNullOrWhiteSpace(code))
            return Results.BadRequest("Missing code.");

        var clientId = config["Google:ClientId"];
        var clientSecret = config["Google:ClientSecret"];

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
            return Results.BadRequest("Server misconfigured: missing Google ClientId or ClientSecret.");

        using var httpClient = new HttpClient();

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code!,
            ["client_id"] = clientId!,
            ["client_secret"] = clientSecret!,
            ["redirect_uri"] = "postmessage",   // required for JS → backend code exchange
            ["grant_type"] = "authorization_code",
        });

        var tokenResp = await httpClient.PostAsync("https://oauth2.googleapis.com/token", form);
        if (!tokenResp.IsSuccessStatusCode)
        {
            var errBody = await tokenResp.Content.ReadAsStringAsync();
            Console.WriteLine("Google token exchange failed: " + errBody);
            return Results.BadRequest("Invalid Google token.");
        }

        var tokenJson = await tokenResp.Content.ReadFromJsonAsync<JsonElement>();
        if (!tokenJson.TryGetProperty("id_token", out var idTokEl))
            return Results.BadRequest("Google token exchange missing id_token.");

        idToken = idTokEl.GetString();
    }

    // Still nothing?
    if (string.IsNullOrWhiteSpace(idToken))
        return Results.BadRequest("Missing idToken or code.");

    // Validate the Google ID token
    var settings = new GoogleJsonWebSignature.ValidationSettings
    {
        Audience = new[] { config["Google:ClientId"] }
    };

    GoogleJsonWebSignature.Payload googlePayload;
    try
    {
        googlePayload = await GoogleJsonWebSignature.ValidateAsync(idToken!, settings);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Google ID token validation failed: " + ex);
        return Results.BadRequest("Invalid Google token.");
    }

    // Google always returns an email for normal accounts
    var email = googlePayload.Email;
    if (string.IsNullOrWhiteSpace(email))
        return Results.BadRequest("Google account did not provide an email.");

    // Look for existing user
    var user = await database.Users.SingleOrDefaultAsync(u => u.Email == email);

    // If user doesn't exist → create a new OAuth user
    if (user is null)
    {
        user = new User
        {
            ID = Guid.NewGuid(),
            Email = email,

            // OAuth-only user → no password, satisfy DB constraint
            PasswordHash = null,
            PasswordSalt = null,
            OAuthProvider = "google",
        };

        database.Users.Add(user);
        await database.SaveChangesAsync();
    }
    else
    {
        // Fix incomplete existing rows if needed (old rows before OAuthProvider existed)
        if (user.PasswordHash == null && user.PasswordSalt == null && user.OAuthProvider == null)
        {
            user.OAuthProvider = "google";
            await database.SaveChangesAsync();
        }
    }

    // Set session cookies for logged-in state
    ctx.Session.SetString("UserId", user.ID.ToString());
    ctx.Session.SetString("UserEmail", user.Email);

    // Issue JWT
    string token = Library.JWTMethods.GenerateJwt(user.ID);

    return Results.Ok(new { token, email = user.Email });
});


// apple oauthentication
app.MapPost( "/authentication/apple", async ( [FromServices] Database database, [FromServices] IConfiguration config, HttpRequest http ) => {
    var json_payload = await JsonSerializer.DeserializeAsync<JsonElement>( http.Body );
    if ( !json_payload.TryGetProperty( "idToken", out var id_token_element ) ) return Results.BadRequest( "Missing idToken." );

    var id_token = id_token_element.GetString();
    if ( string.IsNullOrWhiteSpace( id_token ) ) return Results.BadRequest("Missing idToken.");


    var expected_audience = config["Apple:ClientId"];
    if ( string.IsNullOrWhiteSpace( expected_audience ) ) return Results.BadRequest("Server missing Apple:ClientId configuration.");

    JwtSecurityToken jwt;
    try {
        jwt = await AppleJwtValidator.ValidateAsync( id_token!, expected_audience );
    }
    catch {
        return Results.BadRequest("Invalid Apple token");
    }

    var sub = jwt.Subject; // stable Apple user id
    var email = jwt.Payload.TryGetValue( "email", out var apple_email ) ? apple_email?.ToString() : null;

    if ( string.IsNullOrWhiteSpace( email ) ) email = $"{sub}@apple.local";

    var user = await database.Users.SingleOrDefaultAsync( user => user.Email == email );
    if ( user is null ) {
        user = new User { ID = Guid.NewGuid(), Email = email };
        database.Users.Add( user );
        await database.SaveChangesAsync();
    }

    string token = Library.JWTMethods.GenerateJwt( user.ID );
    return Results.Ok( new { token } );
});

#endregion

// GET /authentication/jwt/sign
app.MapGet( "/authentication/jwt/sign", ( [FromQuery] Guid user_id ) => {
  string token = Library.JWTMethods.GenerateJwt( user_id );
  return Results.Ok( new { token } );
});


app.Run();

static object ShapeItem( Item item ) {
  return new {
    item.ID,
    item.OwnerID,
    item.Name,
    item.Description,
    Category = item.Category.ToString(),
    ImageKeys = (item.Images ?? Array.Empty<Image>()).Select( image => image.Key ).ToArray()
  };
}

static object ShapeTrade( Trade trade, IEnumerable<Item> sourceItems ) {
  var item_lookup = sourceItems.ToDictionary( item => item.ID, item => item );
  var offering = trade.OfferingItemIDs.Select( id => item_lookup.TryGetValue( id, out var found ) ? ShapeItem( found ) : null ).Where( item => item is not null ).ToArray();
  var seeking = trade.SeekingItemIDs.Select( id => item_lookup.TryGetValue( id, out var found ) ? ShapeItem( found ) : null ).Where( item => item is not null ).ToArray();

  return new {
    trade.ID,
    trade.InitiatorID,
    trade.ReceiverID,
    Status = trade.Status.ToString(),
    OfferingItems = offering,
    SeekingItems = seeking
  };
}

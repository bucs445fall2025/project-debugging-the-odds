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

var app = builder.Build();

// enabling swagger for development environment only
if ( app.Environment.IsDevelopment() ) {
   app.UseSwagger();
   app.UseSwaggerUI( context => { context.SwaggerEndpoint( "/swagger/v1/swagger.json", "Bartering API V1" ); } );
}

//enable CORS before endpoints
app.UseCors(CorsPolicy);

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

#region Item Routes
// Item Routes
app.MapPost( "create/item", async ( [FromServices] Database database, [FromBody] CreateItemRequest request ) => {
  var item = new Item {
    ID = Guid.NewGuid(),
    OwnerID = request.OwnerID,
    Name = request.Name,
    Description = request.Description,
    Category = request.Category,
    Images = Array.Empty<Image>()
  };

  database.Items.Add( item );
  await database.SaveChangesAsync();

  return Results.Ok( item );
});

app.MapPatch( "update/item", async ( [FromServices] Database database, [FromBody] UpdateItemRequest request ) => {
  var item = await database.Items.FindAsync( request.ID );
  if ( item is null ) return Results.NotFound( "Item not found." );
  
  item.Name = request.Name;
  item.Description = request.Description;
  item.Category = request.Category;


  database.Items.Update( item );
  await database.SaveChangesAsync();
  return Results.Ok( item );
});

app.MapGet( "get/items/by/owner/{owner_id:guid}", async ( [FromServices] Database database, Guid owner_id ) => {
  var items = await database.Items.Where( item => item.OwnerID == owner_id ).ToListAsync();
  return Results.Ok( items );
});

app.MapGet( "get/item/by/id/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
  var item = await database.Items.FindAsync( id ); 
  if ( item is null ) return Results.NotFound( "Item not found." );
  return Results.Ok( item );
});

// debug routes
app.MapGet( "debug/dump/items", async ( [FromServices] Database database ) => {
  var items = await database.Items.ToListAsync();
  return Results.Json( items );
});

app.MapDelete( "debug/delete/item/{id:guid}", async ( [FromServices] Database database, Guid id ) => {
  var item = await database.Items.SingleOrDefaultAsync( item => item.ID == id );
  if ( item is null ) return Results.BadRequest( "Invalid credentials." );
  database.Items.Remove( item );
  await database.SaveChangesAsync();
  return Results.Ok( "Item Removed." );
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
  var trade = await database.Trades.FindAsync( request.ID );
  if ( trade is null ) return Results.NotFound( "Item not found." );
  
  if ( request.Receiver != trade.ReceiverID ) return Results.BadRequest( "Only the receiving party can update." );

  trade.Status = request.Status;


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

app.MapGet( "get/trades/by/initator/{user_id:guid}", async ( [FromServices] Database database, Guid user_id ) => {
  var trades = await database.Trades.Where( item => item.InitiatorID == user_id ).ToListAsync();
  return Results.Ok( trades );
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

app.MapPost( "/authentication/sign/in", async ( [FromServices] Database database, SignInRequest request ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
  if ( user is null ) return Results.BadRequest( "Invalid credentials user doesn't exist." );

  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + user.PasswordSalt ) ) );
  if (hash != user.PasswordHash) return Results.BadRequest( "Invalid credentials hash." );

  string token = Library.JWTMethods.GenerateJwt( user.ID );

  return Results.Ok( new { token } );
});

// google oauthentication
app.MapPost( "/authentication/google", async ( [FromServices] Database database, [FromServices] IConfiguration config, HttpRequest http ) => {
    var json_payload = await JsonSerializer.DeserializeAsync<JsonElement>( http.Body );
    if ( !json_payload.TryGetProperty( "idToken", out var id_token_element ) ) return Results.BadRequest( "Missing idToken." );

    var id_token = id_token_element.GetString();
    if ( string.IsNullOrWhiteSpace( id_token ) ) return Results.BadRequest("Missing idToken.");

    var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { config["Google:ClientId"] } };

    GoogleJsonWebSignature.Payload google;
    try {
        google = await GoogleJsonWebSignature.ValidateAsync( id_token!, settings );
    }
    catch {
        return Results.BadRequest( "Invalid Google token" );
    }

    var email = google.Email;
    var sub = google.Subject;

    var user = await database.Users.SingleOrDefaultAsync( user => user.Email == email);
    if ( user is null ) {
        user = new User { ID = Guid.NewGuid(), Email = email };
        database.Users.Add( user );
        await database.SaveChangesAsync();
    }

    string token = Library.JWTMethods.GenerateJwt( user.ID );
    return Results.Ok( new { token } );
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

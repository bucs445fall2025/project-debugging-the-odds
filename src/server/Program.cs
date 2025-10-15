using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarterDatabase;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Google.Apis.Auth;
using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Net.Http.Json;
using Resend;

var builder = WebApplication.CreateBuilder( args );

// Adding Swagger Docs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen( context => {
    context.SwaggerDoc( "v1", new OpenApiInfo { Title = "Bartering API", Description = "Trading like crazy idk", Version = "v1" } );
  });

builder.Services.AddDbContext<BarterDatabase.Database>();

var app = builder.Build();

// enabling swagger for development environment only
if ( app.Environment.IsDevelopment() ) {
   app.UseSwagger();
   app.UseSwaggerUI( context => { context.SwaggerEndpoint("/swagger/v1/swagger.json", "Bartering API V1"); } );
}


app.MapGet( "/", () => "Hello World!" );

app.MapGet( "debug/dump/users", async ( [FromServices] Database database ) => {
  var users = await database.Users.ToListAsync();
  return Results.Json( users );
});

app.MapPost( "debug/delete/user", async ( [FromServices] Database database, DeleteUserRequest request ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
  if ( user is null ) return Results.BadRequest( "Invalid credentials." );
  database.Users.Remove( user );
  await database.SaveChangesAsync();
  return Results.Ok( "Account Removed." );
});

app.MapPost( "/authentication/sign/up", async ( [FromServices] Database database, SignUpRequest request ) => {
  if ( await database.Users.AnyAsync( user => user.Email == request.Email ) ) return Results.BadRequest("Email already registered.");

  // Hash password
  // first generate per user salt and turn to url safe string
  var salt = Convert.ToBase64String( RandomNumberGenerator.GetBytes( 16 ) );
  // get bytes hash it and turn to url safe string
  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + salt ) ) );

  var user = new User { ID = Guid.NewGuid(), Email = request.Email, PasswordSalt = salt, PasswordHash = hash };
  database.Users.Add( user );
  await database.SaveChangesAsync();
  return Results.Ok( "Account created." );
});

app.MapPost( "/authentication/sign/in", async ( [FromServices] Database database, SignInRequest request ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
  if ( user is null ) return Results.BadRequest( "Invalid credentials." );

  // get bytes of password and salt, hash it, and turn to url safe string
  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + user.PasswordSalt ) ) );

  // compare both url strings no have to decode
  if (hash != user.PasswordHash) return Results.BadRequest( "Invalid credentials." );

  string token = Library.JWTMethods.GenerateJwt( user.ID );
  return Results.Ok( new { token } );
});

app.MapPost("/authentication/google", async (
    [FromServices] Database database,
    [FromServices] IConfiguration config,
    HttpRequest http
) =>
{
    var payloadJson = await JsonSerializer.DeserializeAsync<JsonElement>(http.Body);
    if (!payloadJson.TryGetProperty("idToken", out var idTokenEl))
        return Results.BadRequest("Missing idToken.");
    var idToken = idTokenEl.GetString();
    if (string.IsNullOrWhiteSpace(idToken))
        return Results.BadRequest("Missing idToken.");

    var settings = new GoogleJsonWebSignature.ValidationSettings
    {
        Audience = new[] { config["Google:ClientId"] }
    };

    GoogleJsonWebSignature.Payload google;
    try
    {
        google = await GoogleJsonWebSignature.ValidateAsync(idToken!, settings);
    }
    catch
    {
        return Results.BadRequest("Invalid Google token");
    }

    var email = google.Email;
    var sub = google.Subject;

    var user = await database.Users.SingleOrDefaultAsync(u => u.Email == email);
    if (user is null)
    {
        user = new User
        {
            ID = Guid.NewGuid(),
            Email = email,
            // Optional if you added it:
            // GoogleSubject = sub
        };
        database.Users.Add(user);
        await database.SaveChangesAsync();
    }

    string token = Library.JWTMethods.GenerateJwt(user.ID);
    return Results.Ok(new { token });
});

app.MapPost("/authentication/apple", async (
    [FromServices] Database database,
    [FromServices] IConfiguration config,
    HttpRequest http
) =>
{
    var payloadJson = await JsonSerializer.DeserializeAsync<JsonElement>(http.Body);
    if (!payloadJson.TryGetProperty("idToken", out var idTokenEl))
        return Results.BadRequest("Missing idToken.");
    var idToken = idTokenEl.GetString();
    if (string.IsNullOrWhiteSpace(idToken))
        return Results.BadRequest("Missing idToken.");

    var expectedAudience = config["Apple:ClientId"];
    if (string.IsNullOrWhiteSpace(expectedAudience))
        return Results.BadRequest("Server missing Apple:ClientId configuration.");

    JwtSecurityToken jwt;
    try
    {
        jwt = await AppleJwtValidator.ValidateAsync(idToken!, expectedAudience);
    }
    catch
    {
        return Results.BadRequest("Invalid Apple token");
    }

    var sub = jwt.Subject; // stable Apple user id
    var email = jwt.Payload.TryGetValue("email", out var e) ? e?.ToString() : null;

    if (string.IsNullOrWhiteSpace(email))
        email = $"{sub}@apple.local";

    var user = await database.Users.SingleOrDefaultAsync(u => u.Email == email);
    if (user is null)
    {
        user = new User
        {
            ID = Guid.NewGuid(),
            Email = email,
        };
        database.Users.Add(user);
        await database.SaveChangesAsync();
    }

    string token = Library.JWTMethods.GenerateJwt(user.ID);
    return Results.Ok(new { token });
});


// GET /authentication/jwt/sign
app.MapGet( "/authentication/jwt/sign", ( [FromQuery] Guid userId ) => {
  string token = Library.JWTMethods.GenerateJwt( userId );
  return Results.Ok( new { token } );
});

app.Run();

static class AppleJwtValidator
{
    private static readonly HttpClient _http = new HttpClient();
    private static JsonWebKeySet? _jwks;
    private static DateTimeOffset _fetchedAt;

    public static async Task<JwtSecurityToken> ValidateAsync(string idToken, string expectedAudience)
    {
        var handler = new JwtSecurityTokenHandler();
        if (!handler.CanReadToken(idToken))
            throw new SecurityTokenException("Unreadable token");

        // Refresh JWKS daily
        if (_jwks is null || DateTimeOffset.UtcNow - _fetchedAt > TimeSpan.FromHours(24))
        {
            _jwks = await _http.GetFromJsonAsync<JsonWebKeySet>("https://appleid.apple.com/auth/keys")
                    ?? throw new SecurityTokenException("Failed to load Apple JWKS");
            _fetchedAt = DateTimeOffset.UtcNow;
        }

        var parms = new TokenValidationParameters
        {
            ValidIssuer = "https://appleid.apple.com",
            ValidateIssuer = true,

            ValidAudience = expectedAudience,
            ValidateAudience = true,

            IssuerSigningKeys = _jwks.Keys,
            ValidateIssuerSigningKey = true,

            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(3),
        };

        handler.ValidateToken(idToken, parms, out var validated);
        var jwt = (JwtSecurityToken)validated;

        // Apple uses RS256; reject anything else
        if (!string.Equals(jwt.Header.Alg, SecurityAlgorithms.RsaSha256, StringComparison.Ordinal))
            throw new SecurityTokenException("Unexpected alg");

        return jwt;
    }
}


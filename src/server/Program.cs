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
using Resend;
using Library;
using Library.Storage;
using static Library.JWTMethods;
using Microsoft.AspNetCore.Authentication.JwtBearer;

const string CorsPolicy = "BarterCors";
Startup.print_startup_message();

var builder = WebApplication.CreateBuilder(args);

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Bartering API", Description = "Trading like crazy idk", Version = "v1" });
});

// DB
builder.Services.AddDbContext<Library.Storage.Database>();

// CORS (dev)
builder.Services.AddCors(origin =>
{
    origin.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials() // required for cookies
    );
});

// Seaweed etc
builder.Services.AddSingleton(new Library.Storage.Seaweed(
    "http://seaweed:8333", "barter_access", "barter_secret", "barter"
));

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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("your_jwt_secret_key_here")),
        ClockSkew = TimeSpan.Zero
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Library.Storage.Database>();
    db.Database.Migrate();
}

// Middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Bartering API V1"));
}
app.UseCors(CorsPolicy);
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

// Routes
app.MapGet("/", () => "Hello World!");

app.MapGet("debug/dump/users", async ([FromServices] Database db) =>
{
    var users = await db.Users.ToListAsync();
    return Results.Json(users);
});

app.MapPost("debug/delete/user", async ([FromServices] Database db, DeleteUserRequest req) =>
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == req.Email);
    if (user is null) return Results.BadRequest("Invalid credentials.");
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok("Account Removed.");
});

app.MapPost("/authentication/sign/up", async ([FromServices] Database db, HttpContext ctx, SignUpRequest req) =>
{
    if (await db.Users.AnyAsync(u => u.Email == req.Email)) return Results.BadRequest("Email already registered.");

    var salt = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
    var hash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(req.Password + salt)));
    var user = new User { ID = Guid.NewGuid(), Email = req.Email, PasswordSalt = salt, PasswordHash = hash };
    db.Users.Add(user);
    await db.SaveChangesAsync();

    // Auto login
    ctx.Session.SetString("UserId", user.ID.ToString());
    ctx.Session.SetString("UserEmail", user.Email);

    string token = Library.JWTMethods.GenerateJwt(user.ID);
    return Results.Ok(new { token });
});

app.MapPost("/authentication/sign/in", async ([FromServices] Database db, HttpContext ctx, SignInRequest req) =>
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == req.Email);
    if (user is null) return Results.BadRequest("Invalid credentials user doesn't exist.");

    var hash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(req.Password + user.PasswordSalt)));
    if (hash != user.PasswordHash) return Results.BadRequest("Invalid credentials hash.");

    // Set session
    ctx.Session.SetString("UserId", user.ID.ToString());
    ctx.Session.SetString("UserEmail", user.Email);

    string token = Library.JWTMethods.GenerateJwt(user.ID);
    return Results.Ok(new { token });
});

// Google OAuth: expects { idToken }
app.MapPost("/authentication/google", async ([FromServices] Database db, [FromServices] IConfiguration config, HttpRequest http, HttpContext ctx) =>
{
    var payload = await JsonSerializer.DeserializeAsync<JsonElement>(http.Body);
    if (!payload.TryGetProperty("idToken", out var idEl)) return Results.BadRequest("Missing idToken.");
    var idToken = idEl.GetString();
    if (string.IsNullOrWhiteSpace(idToken)) return Results.BadRequest("Missing idToken.");

    var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { config["Google:ClientId"] } };
    GoogleJsonWebSignature.Payload google;
    try { google = await GoogleJsonWebSignature.ValidateAsync(idToken!, settings); }
    catch { return Results.BadRequest("Invalid Google token"); }

    var email = google.Email;
    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
    if (user is null)
    {
        user = new User { ID = Guid.NewGuid(), Email = email };
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    // Set session
    ctx.Session.SetString("UserId", user.ID.ToString());
    ctx.Session.SetString("UserEmail", user.Email);

    string token = Library.JWTMethods.GenerateJwt(user.ID);
    return Results.Ok(new { token });
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

app.MapGet("/authentication/jwt/sign", ([FromQuery] Guid userId) =>
{
    string token = Library.JWTMethods.GenerateJwt(userId);
    return Results.Ok(new { token });
});

app.MapGet("/user/profile", (HttpContext context) =>
{
    if (!(context.User.Identity?.IsAuthenticated ?? false)) return Results.Unauthorized();

    var userIdFromSession = context.Session.GetString("UserId");
    if (string.IsNullOrEmpty(userIdFromSession)) return Results.Forbid();

    var jwtUserId = context.User.FindFirstValue("userId");
    if (userIdFromSession != jwtUserId) return Results.Forbid();

    return Results.Ok(new { UserId = userIdFromSession, Email = context.Session.GetString("UserEmail") });
})
.RequireAuthorization();

// Auto-login check — returns fresh JWT if session is valid
app.MapGet("/authentication/check-session", async ([FromServices] Database db, HttpContext ctx) =>
{
    var userIdStr = ctx.Session.GetString("UserId");
    if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        return Results.Unauthorized();

    var user = await db.Users.FindAsync(userId);
    if (user is null) return Results.Unauthorized();

    string token = Library.JWTMethods.GenerateJwt(userId);
    return Results.Ok(new { token, email = user.Email });
});

app.Run();

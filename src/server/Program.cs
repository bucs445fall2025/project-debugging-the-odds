using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarterDatabase;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Library;
using static Library.JWTMethods;

//NEW: allow Vite dev (5173) to call the API
const string CorsPolicy = "BarterCors";

Startup.print_startup_message();

var builder = WebApplication.CreateBuilder( args );

// Adding Swagger Docs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen( context => {
    context.SwaggerDoc( "v1", new OpenApiInfo { Title = "Bartering API", Description = "Trading like crazy idk", Version = "v1" } );
});

// DB context as you had it
builder.Services.AddDbContext<BarterDatabase.Database>();

//register CORS (dev origin)
builder.Services.AddCors(o =>
{
    o.AddPolicy(CorsPolicy, p =>
        p.WithOrigins("http://localhost:5173")
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials()
    );
});

var app = builder.Build();

// enabling swagger for development environment only
if ( app.Environment.IsDevelopment() ) {
   app.UseSwagger();
   app.UseSwaggerUI( context => { context.SwaggerEndpoint("/swagger/v1/swagger.json", "Bartering API V1"); } );
}

//enable CORS before endpoints
app.UseCors(CorsPolicy);

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

  // Hash password (your current approach: SHA256(password + salt))
  var salt = Convert.ToBase64String( RandomNumberGenerator.GetBytes( 16 ) );
  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + salt ) ) );

  var user = new User { ID = Guid.NewGuid(), Email = request.Email, PasswordSalt = salt, PasswordHash = hash, Name = request.Name };
  database.Users.Add( user );
  await database.SaveChangesAsync();

  return Results.Ok( "Account created." );
});

app.MapPost( "/authentication/sign/in", async ( [FromServices] Database database, SignInRequest request ) => {
  var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
  if ( user is null ) return Results.BadRequest( "Invalid credentials." );

  var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + user.PasswordSalt ) ) );
  if (hash != user.PasswordHash) return Results.BadRequest( "Invalid credentials." );

  string token = Library.JWTMethods.GenerateJwt( user.ID );
  return Results.Ok( new { token } );
});

app.MapGet( "/authentication/jwt/validate", ( [FromQuery] string token ) => {
  try {
    var principal = Library.JWTMethods.ValidateJwt( token );
    return Results.Ok( new { valid = true, user = principal.FindFirstValue( ClaimTypes.NameIdentifier ) } );
  } catch {
    return Results.BadRequest( new { valid = false } );
  }
});

// GET /authentication/jwt/sign
app.MapGet( "/authentication/jwt/sign", ( [FromQuery] Guid userId ) => {
  string token = Library.JWTMethods.GenerateJwt( userId );
  return Results.Ok( new { token } );
});


// ------------------------------------------------------------
//api/auth/* aliases so frontend can call relative `/api/...`
// ------------------------------------------------------------

app.MapPost("/api/auth/signup", async ([FromServices] Database database, SignUpRequest request) =>
{
    // Reuse same logic as /authentication/sign/up
    if ( await database.Users.AnyAsync( user => user.Email == request.Email ) ) return Results.BadRequest("Email already registered.");
    var salt = Convert.ToBase64String( RandomNumberGenerator.GetBytes( 16 ) );
    var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + salt ) ) );
    var user = new User { ID = Guid.NewGuid(), Email = request.Email, PasswordSalt = salt, PasswordHash = hash, Name = request.Name };
    database.Users.Add( user );
    await database.SaveChangesAsync();
    return Results.Ok( "Account created." );
});

app.MapPost("/api/auth/signin", async ([FromServices] Database database, SignInRequest request) =>
{
    var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
    if ( user is null ) return Results.BadRequest( "Invalid credentials." );
    var hash = Convert.ToBase64String( SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + user.PasswordSalt ) ) );
    if (hash != user.PasswordHash) return Results.BadRequest( "Invalid credentials." );
    string token = Library.JWTMethods.GenerateJwt( user.ID );
    return Results.Ok( new { token } );
});

app.Run();

using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarterDatabase;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Library;
using static Library.JWTMethods;


Startup.print_startup_message();

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

app.MapGet( "debug/dump/users", async ( [FromServices] Database database ) =>
{
    var users = await database.Users.ToListAsync();
    return Results.Json( users );
});

app.MapPost( "/authentication/sign/up", async ( [FromServices] Database database, SignUpRequest request ) =>
{
    if ( await database.Users.AnyAsync( user => user.Email == request.Email ) )
        return Results.BadRequest("Email already registered.");

    // Hash password
    var salt = Convert.ToBase64String( RandomNumberGenerator.GetBytes( 16 ) );
    var hash = Convert.ToBase64String(
        SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + salt ) )
    );

    var user = new User { ID = Guid.NewGuid(), Email = request.Email, PasswordSalt = salt, PasswordHash = hash };
    database.Users.Add( user );
    await database.SaveChangesAsync();

    return Results.Ok("Account created.");
});

app.MapPost( "/authentication/sign/in", async ( [FromServices] Database database, SignInRequest request ) =>
{
    var user = await database.Users.SingleOrDefaultAsync( user => user.Email == request.Email );
    if ( user is null ) return Results.BadRequest("Invalid credentials.");

    var hash = Convert.ToBase64String(
        SHA256.HashData( Encoding.UTF8.GetBytes( request.Password + user.PasswordSalt ) )
    );

    if (hash != user.PasswordHash) return Results.BadRequest("Invalid credentials.");

    string token = Library.JWTMethods.GenerateJwt( user.ID );
    return Results.Ok( new { token } );
});

app.MapGet( "/authentication/jwt/validate", ( [FromQuery] string token ) =>
{
    try
    {
        var principal = ValidateJwt( token );
        return Results.Ok( new { valid = true, user = principal.FindFirstValue( ClaimTypes.NameIdentifier ) } );
    }
    catch
    {
        return Results.BadRequest( new { valid = false } );
    }
});

// GET /authentication/jwt/sign
app.MapGet( "/authentication/jwt/sign", ( [FromQuery] Guid userId ) =>
{
    string token = GenerateJwt( userId );
    return Results.Ok( new { token } );
});

app.Run();

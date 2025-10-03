using Microsoft.OpenApi.Models;
using Library;

Startup.print_startup_message();

var builder = WebApplication.CreateBuilder( args );

// Adding Swagger Docs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen( context => {
    context.SwaggerDoc( "v1", new OpenApiInfo { Title = "Bartering API", Description = "Trading like crazy idk", Version = "v1" } );
  });

var app = builder.Build();

// enabling swagger for development environment only
if ( app.Environment.IsDevelopment() ) {
   app.UseSwagger();
   app.UseSwaggerUI( context => { context.SwaggerEndpoint("/swagger/v1/swagger.json", "Bartering API V1"); } );
}


app.MapGet( "/", () => "Hello World!" );

app.MapPost( "/authentication/sign/up", () => "" );
app.MapPost( "/authentication/sign/in", () => "" );
app.MapGet( "/authentication/jwt/validate", () => "" );
app.MapGet( "/authentication/jwt/sign", () => "" );

app.Run();

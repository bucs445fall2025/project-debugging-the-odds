using Library.Storage;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Amazon.S3;
using Amazon.S3.Model;

namespace Library {
  public static class Startup {
    public static void print_startup_message() {
      Console.WriteLine(@"
      ...     ..                                    s                               .                              
  .=*8888x <""?88h.                                :8                              @88>                            
 X>  '8888H> '8888                  .u    .      .88                  .u    .     %8P      u.    u.               
'88h. `8888   8888         u      .d88B :@8c    :888ooo      .u     .d88B :@8c     .     x@88k u@88c.      uL     
'8888 '8888    ""88>     us888u.  =""8888f8888r -*8888888   ud8888.  =""8888f8888r  .@88u  ^""8888""""8888""  .ue888Nc.. 
 `888 '8888.xH888x.  .@88 ""8888""   4888>'88""    8888    :888'8888.   4888>'88""  ''888E`   8888  888R  d88E`""888E` 
   X"" :88*~  `*8888> 9888  9888    4888> '      8888    d888 '88%""   4888> '      888E    8888  888R  888E  888E  
 ~""   !""`      ""888> 9888  9888    4888>        8888    8888.+""      4888>        888E    8888  888R  888E  888E  
  .H8888h.      ?88  9888  9888   .d888L .+    .8888Lu= 8888L       .d888L .+     888E    8888  888R  888E  888E  
 :""^""88888h.    '!   9888  9888   ^""8888*""     ^%888*   '8888c. .+  ^""8888*""      888&   ""*88*"" 8888"" 888& .888E  
 ^    ""88888hx.+""    ""888*""""888""     ""Y""         'Y""     ""88888%       ""Y""        R888""    """"   'Y""   *888"" 888&  
        ^""**""""        ^Y""   ^Y'                            ""YP'                    """"                  `""   ""888E 
                                                                                                      .dWi   `88E 
                                                                                                      4888~  J8%  
                                                                                                       ^""===*""`   
       ...                                    _            .                                                      
   .x888888hx    :                           u            @88>                                                    
  d88888888888hxx                .u    .    88Nu.   u.    %8P                                                     
 8"" ... `""*8888%`       .u     .d88B :@8c  '88888.o888c    .          .        .u                                 
!  ""   ` .xnxx.      ud8888.  =""8888f8888r  ^8888  8888  .@88u   .udR88N    ud8888.                               
X X   .H8888888%:  :888'8888.   4888>'88""    8888  8888 ''888E` <888'888k :888'8888.                              
X 'hn8888888*""   > d888 '88%""   4888> '      8888  8888   888E  9888 'Y""  d888 '88%""                              
X: `*88888%`     ! 8888.+""      4888>        8888  8888   888E  9888      8888.+""                                 
'8h.. ``     ..x8> 8888L       .d888L .+    .8888b.888P   888E  9888      8888L                                   
 `88888888888888f  '8888c. .+  ^""8888*""      ^Y8888*""""    888&  ?8888u../ '8888c. .+                              
  '%8888888888*""    ""88888%       ""Y""          `Y""        R888""  ""8888P'   ""88888%                                
     ^""****""""`        ""YP'                                 """"      ""P'       ""YP'                                 
                                                                                                                                                                                                                               
    ");
    }
  }


  static class AppleJwtValidator {
    private static readonly HttpClient http_client = new HttpClient();
    private static JsonWebKeySet? jwks;
    private static DateTimeOffset fetched_at;

    public static async Task<JwtSecurityToken> ValidateAsync( string id_token, string expected_audience ) {
        var handler = new JwtSecurityTokenHandler();
        if ( !handler.CanReadToken( id_token ) ) throw new SecurityTokenException("Unreadable token");

        // Refresh JWKS daily
        if ( jwks is null || DateTimeOffset.UtcNow - fetched_at > TimeSpan.FromHours( 24 ) ) {
            jwks = await http_client.GetFromJsonAsync<JsonWebKeySet>("https://appleid.apple.com/auth/keys")
                    ?? throw new SecurityTokenException("Failed to load Apple JWKS");
            fetched_at = DateTimeOffset.UtcNow;
        }

        var validation_parameters = new TokenValidationParameters {
            ValidIssuer = "https://appleid.apple.com",
            ValidateIssuer = true,

            ValidAudience = expected_audience,
            ValidateAudience = true,

            IssuerSigningKeys = jwks.Keys,
            ValidateIssuerSigningKey = true,

            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(3),
        };

        handler.ValidateToken( id_token, validation_parameters, out var validated );
        var jwt = ( JwtSecurityToken )validated;

        // Apple uses RS256; reject anything else
        if ( !string.Equals( jwt.Header.Alg, SecurityAlgorithms.RsaSha256, StringComparison.Ordinal ) ) throw new SecurityTokenException("Unexpected alg");

        return jwt;
    }
  }


  public static class JWTMethods { // name subject to change stoned rn not wasting brain power

    public static string GenerateJwt( Guid userId ) {
      var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("supersecretkey123THISWILLBECHANGEDLATER"));
      var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

      var token = new JwtSecurityToken(
        claims: new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) },
        expires: DateTime.UtcNow.AddHours(1),
        signingCredentials: creds
      );

      return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static ClaimsPrincipal ValidateJwt( string token ) {
      var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("supersecretkey123THISWILLBECHANGEDLATER"));
      var parameters = new TokenValidationParameters
        {
          ValidateIssuer = false,
          ValidateAudience = false,
          IssuerSigningKey = key,
          ValidateLifetime = true
        };
      return new JwtSecurityTokenHandler().ValidateToken(token, parameters, out _);
    }
  }

  public static class StorageMethods { // name subject to change stoned rn not wasting brain power
    public static void get_user( string email ) {
      using var database = new Database();
      var user = database.Users.First( user => user.Email == email );
      //return user;
    }

    public static ( IAmazonS3 client, string bucket ) GetClientAndBucket( Seaweed seaweed ) {
      var client_field = typeof( Seaweed ).GetField( "client", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance );
      var bucket_field = typeof( Seaweed ).GetField( "bucket", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance );

      if ( client_field == null || bucket_field == null ) throw new InvalidOperationException( "Could not access Seaweed internal fields." );

      var client = (IAmazonS3)client_field.GetValue( seaweed )!;
      var bucket = (string)bucket_field.GetValue( seaweed )!;

      return ( client, bucket );
    }
  }
}

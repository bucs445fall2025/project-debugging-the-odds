public record SignUpRequest( string Email, string Password );
public record SignInRequest( string Email, string Password );
public record DeleteUserRequest( string Email );

namespace BarterDatabase {
  using Microsoft.EntityFrameworkCore;
  
  // users table schema
  public class User {
    public required Guid ID { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public string? Name { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Username/Password Authentication
    public string? PasswordSalt { get; set; }                // Null if not using password auth
    public string? PasswordHash { get; set; }

    // OAuth Authentication
    public string? OAuthProvider { get; set; }               // e.g. "google", "microsoft", "facebook"
  }

  public class Database : DbContext {
    public DbSet<User> Users => Set<User>();

    protected override void OnConfiguring( DbContextOptionsBuilder options_builder ) {
      options_builder.UseNpgsql( "database-url" );
    }

    protected override void OnModelCreating( ModelBuilder model_builder ) {
      model_builder.Entity<User>()
        .HasIndex( user => user.Email )
        .IsUnique();
    }
  }
}

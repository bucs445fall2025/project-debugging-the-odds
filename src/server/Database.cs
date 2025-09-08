namespace Database {
  using Microsoft.EntityFrameworkCore;
  
  // users table schema
  public class User {
    public string ID { get; set; }
    public string Email { get; set; }
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

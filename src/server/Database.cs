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
        public string? PasswordSalt { get; set; }
        public string? PasswordHash { get; set; }

        // OAuth Authentication
        public string? OAuthProvider { get; set; }

        // Navigation
        public ICollection<Item> Items { get; set; } = new List<Item>();
    }

    // items table schema
    public class Item {
        public required Guid ID { get; set; } = Guid.NewGuid();
        public required string Name { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public required Guid OwnerID { get; set; }
        public User? Owner { get; set; } = null!;

        public required Category Category { get; set; }
    }

    public class Database : DbContext {
        public DbSet<User> Users => Set<User>();
        public DbSet<Item> Items => Set<Item>();

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) {
            // Use environment variable or config for dockerized connection
            //var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") 
                                   //?? "Host=localhost;Port=5432;Database=barter;Username=barter_user;Password=barter_password";

            var connection_string = "Host=database;Port=5432;Database=barter;Username=barter_user;Password=barter_password";
            optionsBuilder.UseNpgsql(connection_string);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder) {
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            //modelBuilder.Entity<User>()
            //   .HasCheckConstraint()

            modelBuilder.Entity<Item>()
                .HasOne(i => i.Owner)
                .WithMany(u => u.Items)
                .HasForeignKey(i => i.OwnerID)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}


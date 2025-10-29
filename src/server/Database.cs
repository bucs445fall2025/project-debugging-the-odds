namespace BarterDatabase {
    using Microsoft.EntityFrameworkCore;

    public enum Category {
        Clothing,
        Electronics,
        Furniture,
        Books,
        Labor,
        Tools,
        Experience,
        Other
    }

    // users table schema
    public class User {
        public required Guid ID { get; set; } = Guid.NewGuid();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public required string Email { get; set; }
        public string? Name { get; set; }

        public Guid? ProfilePictureID { get; set; }
        public Image? ProfilePicture { get; set; }

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
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public required string Name { get; set; }
        public string? Description { get; set; }

        public required Guid OwnerID { get; set; }
        public User? Owner { get; set; }

        public required Category Category { get; set; }

        public required ICollection<Image> Images { get; set; } = new List<Image>();
    }

    public class Image {
        public required Guid ID { get; set; } = Guid.NewGuid();
        public string CreatedAt { get; set; } = DateTime.UtcNow;
        public required Guid ItemID { get; set; }
        public Item? Item { get; set; }

        public string Bucket { get; set; } = "barter";
        public string Key { get; set; }
        public string MimeType { get; set; } = "image/png";
    }

    public class Database : DbContext {
        public DbSet<User> Users => Set<User>();
        public DbSet<Item> Items => Set<Item>();
        public DbSet<Image> Images => set<Image>();

        protected override void OnConfiguring( DbContextOptionsBuilder optionsBuilder ) {
            // Use environment variable or config for dockerized connection
            //var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") 
                                   //?? "Host=localhost;Port=5432;Database=barter;Username=barter_user;Password=barter_password";

            var connection_string = "Host=database;Port=5432;Database=barter;Username=barter_user;Password=barter_password";
            optionsBuilder.UseNpgsql( connection_string );
        }

        protected override void OnModelCreating( ModelBuilder modelBuilder ) {
            modelBuilder.Entity<User>()
                .HasIndex( user => user.Email )
                .IsUnique();

            // ensure either password or oauth but never neither
            modelBuilder.Entity<User>()
                .HasCheckConstraint( "CHECK_User_AuthenticationFields",
                    @"(
                        (""PasswordHash"" IS NOT NULL AND ""PasswordSalt"" IS NOT NULL AND ""OAuthProvider"" IS NULL)
                        OR
                        (""PasswordHash"" IS NULL AND ""PasswordSalt"" IS NULL AND ""OAuthProvider"" IS NOT NULL)
                    )" );

            modelBuilder.Entity<Item>()
                .HasOne( item => item.Owner )
                .WithMany( user => user.Items )
                .HasForeignKey( item => item.OwnerID )
                .OnDelete( DeleteBehavior.Cascade );

            modelBuilder.Entity<Image>()
                .HasIndex( image => image.Key )
                .IsUnique();
        }
    }
}


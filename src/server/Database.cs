namespace Library.Storage {
    using Microsoft.EntityFrameworkCore;
    using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
    using System.Text.Json;

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

    public enum Status {
        Requested,
        Accepted,
        Rejected,
        Countered
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

        public double Rating { get; set; } = 5.0;
        public Category? Seeking { get; set; } = null;
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
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public required Guid ItemID { get; set; }
        public Item? Item { get; set; }

        public string Bucket { get; set; } = "barter";
        public required string Key { get; set; }
        public string MimeType { get; set; } = "image/png";
    }

    public class Trade {
        public required Guid ID { get; set; } = Guid.NewGuid();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public required Guid InitiatorID { get; set; }
        public required Guid ReceiverID { get; set; }

        public required Guid[] OfferingItemIDs { get; set; } = Array.Empty<Guid>();
        public required Guid[] SeekingItemIDs { get; set; } = Array.Empty<Guid>();

        public required Status Status { get; set; } = Status.Requested;

        public User? Initiator { get; set; }
        public User? Receiver { get; set; }
    }

    public class Database : DbContext {
        public DbSet<User> Users => Set<User>();
        public DbSet<Item> Items => Set<Item>();
        public DbSet<Image> Images => Set<Image>();
        public DbSet<Trade> Trades => Set<Trade>();

        protected override void OnConfiguring( DbContextOptionsBuilder optionsBuilder ) {
            // Use environment variable or config for dockerized connection
            //var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") 
                                   //?? "Host=localhost;Port=5432;Database=barter;Username=barter_user;Password=barter_password";

            var connection_string = "Host=database;Port=5432;Database=barter;Username=barter_user;Password=barter_password";
            optionsBuilder.UseNpgsql( connection_string );
        }

        protected override void OnModelCreating( ModelBuilder modelBuilder ) {
            var guid_array_converter = new ValueConverter<Guid[], string>(
              v => JsonSerializer.Serialize(v, new JsonSerializerOptions()),
              v => JsonSerializer.Deserialize<Guid[]>(v, new JsonSerializerOptions()) ?? Array.Empty<Guid>()            
            );

            modelBuilder.Entity<User>()
                .HasIndex( user => user.Email )
                .IsUnique();

            // ensure either password or oauth but never neither
            modelBuilder.Entity<User>()
              .ToTable(table => table.HasCheckConstraint(
                "CHECK_User_AuthenticationFields",
                @" ( (""PasswordHash"" IS NOT NULL AND ""PasswordSalt"" IS NOT NULL AND ""OAuthProvider"" IS NULL)
                  OR
                    (""PasswordHash"" IS NULL AND ""PasswordSalt"" IS NULL AND ""OAuthProvider"" IS NOT NULL)
                )"
            ));

            modelBuilder.Entity<Item>()
                .HasOne( item => item.Owner )
                .WithMany( user => user.Items )
                .HasForeignKey( item => item.OwnerID )
                .OnDelete( DeleteBehavior.Cascade );

            modelBuilder.Entity<Image>()
                .HasIndex( image => image.Key )
                .IsUnique();


            modelBuilder.Entity<Trade>()
                .Property( trade => trade.OfferingItemIDs )
                .HasConversion( guid_array_converter )
                .HasColumnType( "jsonb" );

            modelBuilder.Entity<Trade>()
                .Property( trade => trade.SeekingItemIDs )
                .HasConversion( guid_array_converter )
                .HasColumnType( "jsonb" );

            modelBuilder.Entity<Trade>( entity => {
                entity.HasOne( trade => trade.Initiator )
                .WithMany()
                .HasForeignKey( trade => trade.InitiatorID )
                .OnDelete( DeleteBehavior.Restrict );

                entity.HasOne( trade => trade.Receiver )
                .WithMany()
                .HasForeignKey( trade => trade.ReceiverID )
                .OnDelete( DeleteBehavior.Restrict );

                // Disallow self-trade
                entity.ToTable(table => table.HasCheckConstraint(
                  "CK_Trade_DifferentUsers", @"""InitiatorID"" <> ""ReceiverID"""
                ));
            });
        }
    }
}


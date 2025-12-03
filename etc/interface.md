class User:
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
        public List<Item> Items { get; set; } = new();
    }

	1) Modify types of user data
	2) Store all the users information
	3) No, just the user storage specialist
	4) Yes, makes sense on it's own
	5) It can grow without us modifying by using helper function

public class Item {
        public required Guid ID { get; set; } = Guid.NewGuid();
        public required string Name { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public required Guid OwnerID { get; set; }
        public User Owner { get; set; } = null!;
    }

	1) Modify item data tracked
	2) Store all information of items that can be traded
	3) No, just an item storage specialist
	4) Yes, makes sense on its own
	5) It can grow by using helper functions that use its data

public Trade {
	public required Guid ID { get; set; } = Guid.NewGuid();
	public User sender { get; set; }
	public User reciever { get; set; }
	public List<Guid>() item_ids { get;, set; }
	public bool flagged { get; set; }
	public string status { get; set; }
}


	1) Modify types of trade data
	2) Store all the trade information
	3) No, just the trade storage specialist
	4) Yes, makes sense on it's own
	5) It can grow without us modifying by using helper function

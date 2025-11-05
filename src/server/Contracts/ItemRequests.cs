using Library.Storage;
public record CreateItemRequest( Guid OwnerID, string Name, string? Description, Category Category, Guid[]? Images = null );
public record UpdateItemRequest( Guid ID, string Name, string? Description, Category Category, Guid[]? Images = null );
public record DeleteItemRequest( Guid ID );

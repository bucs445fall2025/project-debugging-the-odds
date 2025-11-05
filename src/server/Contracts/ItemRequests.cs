using Library.Storage;
public record GetItemByOwnerRequest( Guid OwnerID );
public record GetItemByIDRequest( Guid ID );
public record CreateItemRequest( Guid OwnerID, string Name, string? Description, Category Category, Guid[]? Images = null );
public record UpdateItemRequest( Guid ID, string Name, string? Description, Category Category, Guid[]? Images = null );
public record DeleteItemRequest( Guid ID );

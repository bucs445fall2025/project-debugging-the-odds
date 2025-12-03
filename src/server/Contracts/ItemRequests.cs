using Library.Storage;

public record CreateItemRequest(
  Guid OwnerID,
  string Name,
  string? Description,
  string Category,
  string[]? ImageKeys = null
);

public record UpdateItemRequest(
  Guid ID,
  string Name,
  string? Description,
  string Category,
  string[]? ImageKeys = null
);

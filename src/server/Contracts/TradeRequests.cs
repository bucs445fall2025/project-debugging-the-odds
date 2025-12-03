using Library.Storage;
public record CreateTradeRequest( Guid Initiator, Guid Receiver, Guid[] OfferingItems, Guid[] SeekingItems );
public record UpdateTradeRequest( Guid ID, Guid Receiver, string Status );

using Amazon.S3;
using Amazon.S3.Model;

namespace Library.Storage {
  public class Seaweed {
    private readonly IAmazonS3 client;
    private readonly string bucket;

    public Seaweed( string endpoint, string access_key, string secret_key, string bucket_id ) {
        var config = new AmazonS3Config {
            ServiceURL = endpoint,
            ForcePathStyle = true
        };
        client = new AmazonS3Client( access_key, secret_key, config );
        bucket = bucket_id;
    }

    public async Task<string> Upload( string key, Stream stream, string content_type ) {
        var request = new PutObjectRequest {
            BucketName = bucket,
            Key = key,
            InputStream = stream,
            ContentType = content_type,
            Headers = { ContentLength = stream.Length }
        };

        request.UseChunkEncoding = false;

        Console.WriteLine( $"POST { content_type }[ { stream.Length } ] -> { bucket }: { key }" );

        await client.PutObjectAsync( request );
        return key;
    }

    public async Task<(Stream, string)> Download( string key ) {
        var response = await client.GetObjectAsync( bucket, key );
        return ( response.ResponseStream, response.Headers.ContentType );
    }
  }
}

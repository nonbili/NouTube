#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^NouDownloadProgressHandler)(double progress, NSString *line);

@interface NouPythonDownload : NSObject
+ (nullable NSString *)downloadURL:(NSString *)url
                         directory:(NSString *)directory
                             proxy:(nullable NSString *)proxy
                          progress:(nullable NouDownloadProgressHandler)progress
                             error:(NSError **)error NS_SWIFT_NAME(download(url:directory:proxy:progress:));
@end

NS_ASSUME_NONNULL_END

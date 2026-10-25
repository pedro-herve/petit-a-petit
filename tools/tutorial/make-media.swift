// Builds the install-tutorial MP4 and GIF from the rendered frames.
// Usage: swift tools/tutorial/make-media.swift <frames dir> <platform> <out dir> <step count>
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let framesDir = args[1], platform = args[2], outDir = args[3]
let count = Int(args[4])!

func load(_ name: String) -> CGImage {
  let url = URL(fileURLWithPath: "\(framesDir)/\(name)")
  let src = CGImageSourceCreateWithURL(url as CFURL, nil)!
  return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}

// Timeline: intro card, steps (blinking tap marker), final card.
var timeline: [(CGImage, Double)] = []
for i in 0..<count {
  let a = load(String(format: "%@-%02d-a.png", platform, i))
  if i == 0 { timeline.append((a, 3.0)); continue }
  if i == count - 1 { timeline.append((a, 4.5)); continue }
  let b = load(String(format: "%@-%02d-b.png", platform, i))
  timeline += [(a, 0.6), (b, 0.8), (a, 0.35), (b, 2.4)]
}

// ---------- MP4 ----------
let W = 720, H = 1280, FPS: Int32 = 10
let mp4 = URL(fileURLWithPath: "\(outDir)/instalar-\(platform).mp4")
try? FileManager.default.removeItem(at: mp4)
let writer = try! AVAssetWriter(outputURL: mp4, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 1_400_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func buffer(_ img: CGImage) -> CVPixelBuffer {
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  let b = pb!
  CVPixelBufferLockBaseAddress(b, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(b), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(b),
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
  CVPixelBufferUnlockBaseAddress(b, [])
  return b
}

var frameIndex: Int64 = 0
for (img, secs) in timeline {
  let pb = buffer(img)
  for _ in 0..<Int((secs * Double(FPS)).rounded()) {
    while !input.isReadyForMoreMediaData { usleep(2000) }
    adaptor.append(pb, withPresentationTime: CMTime(value: frameIndex, timescale: FPS))
    frameIndex += 1
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("MP4:", mp4.path, writer.status == .completed ? "ok" : "ERRO \(String(describing: writer.error))")

// ---------- GIF (3/4 size) ----------
let gif = URL(fileURLWithPath: "\(outDir)/instalar-\(platform).gif")
let dest = CGImageDestinationCreateWithURL(gif as CFURL, UTType.gif.identifier as CFString, timeline.count, nil)!
CGImageDestinationSetProperties(dest, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
func shrink(_ img: CGImage) -> CGImage {
  let ctx = CGContext(data: nil, width: W * 3 / 4, height: H * 3 / 4, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: W * 3 / 4, height: H * 3 / 4))
  return ctx.makeImage()!
}
for (img, secs) in timeline {
  CGImageDestinationAddImage(dest, shrink(img), [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: secs, kCGImagePropertyGIFUnclampedDelayTime: secs]] as CFDictionary)
}
print("GIF:", gif.path, CGImageDestinationFinalize(dest) ? "ok" : "ERRO")

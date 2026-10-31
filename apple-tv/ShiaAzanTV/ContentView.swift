import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebView()
            .ignoresSafeArea()
            .background(Color.black)
    }
}

/// Fullscreen WKWebView around the bundled TV page (TVPage.html).
///
/// The page is a zero-interaction design: on launch it auto-detects the
/// city via an anonymous IP lookup and renders prayer times, a live
/// countdown and the Qibla direction without any taps. The Siri Remote
/// touch surface scrolls the page; taps on the large buttons open the
/// city picker and settings.
struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Let the adhan play at prayer time without a prior user gesture.
        config.mediaPlaybackRequiresUserAction = false
        config.allowsInlineMediaPlayback = true

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.scrollView.isScrollEnabled = true

        if let url = Bundle.main.url(forResource: "TVPage", withExtension: "html") {
            wv.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

#Preview {
    ContentView()
}

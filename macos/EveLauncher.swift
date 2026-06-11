import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var serverProcess: Process?
    private let url = URL(string: "http://127.0.0.1:8100")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        applyAppIcon()
        startServer()
        buildWindow()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            self.webView?.load(URLRequest(url: self.url))
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        serverProcess?.terminate()
    }

    private func startServer() {
        guard let resourcePath = Bundle.main.resourcePath else { return }
        let binaryURL = URL(fileURLWithPath: resourcePath).appendingPathComponent("EveServer")
        let process = Process()
        process.executableURL = binaryURL
        process.environment = ProcessInfo.processInfo.environment.merging([
            "EVE_BIND": "127.0.0.1:8100",
            "EVE_DB_PATH": NSHomeDirectory() + "/Library/Application Support/Eve/eve.db",
        ]) { _, new in new }
        serverProcess = process
        try? FileManager.default.createDirectory(
            atPath: NSHomeDirectory() + "/Library/Application Support/Eve",
            withIntermediateDirectories: true
        )
        try? process.run()
    }

    private func applyAppIcon() {
        guard let iconURL = Bundle.main.url(forResource: "Eve", withExtension: "icns"),
              let image = NSImage(contentsOf: iconURL) else {
            return
        }
        NSApp.applicationIconImage = image
    }

    private func buildWindow() {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1240, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Eve"
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        self.window = window

        let menu = NSMenu()
        let appItem = NSMenuItem()
        menu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Open in Browser", action: #selector(openInBrowser), keyEquivalent: "b")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Eve", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        NSApp.mainMenu = menu
    }

    @objc private func openInBrowser() {
        NSWorkspace.shared.open(url)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()

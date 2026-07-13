import Capacitor

/// Exposes Capacitor's built-in live-update mechanism (the same one used by
/// Ionic AppFlow "Live Updates") to the JS-side HotUpdateManager. Capacitor's
/// CAPBridgeViewController already reads a persisted `serverBasePath` key on
/// launch and, when set, loads the WebView from
/// Library/NoCloud/ionic_built_snapshots/<last path component of that value>
/// instead of the app-bundled `public` directory — see
/// CAPBridgeViewController.instanceDescriptor() in the Capacitor iOS pod.
///
/// It also automatically clears that key whenever the native app binary
/// itself changes (CFBundleVersion/CFBundleShortVersionString), so a stale
/// hot-update can never survive an App Store upgrade.
@objc(HotUpdatePlugin)
public class HotUpdatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HotUpdatePlugin"
    public let jsName = "HotUpdate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise)
    ]

    private static let serverBasePathKey = "serverBasePath"

    @objc func activate(_ call: CAPPluginCall) {
        guard let buildId = call.getString("buildId"), !buildId.isEmpty else {
            call.reject("buildId is required")
            return
        }
        KeyValueStore.standard[Self.serverBasePathKey] = buildId
        call.resolve()
    }

    @objc func reset(_ call: CAPPluginCall) {
        KeyValueStore.standard[Self.serverBasePathKey, as: String.self] = nil
        call.resolve()
    }
}

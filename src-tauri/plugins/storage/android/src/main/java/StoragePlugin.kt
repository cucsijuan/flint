package io.github.cucsijuan.flint.storage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.Settings
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class StoragePlugin(private val activity: Activity) : Plugin(activity) {
    private fun isGranted() =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager()

    private fun access() = JSObject().apply { put("granted", isGranted()) }

    @Command
    fun hasAllFilesAccess(invoke: Invoke) {
        invoke.resolve(access())
    }

    /** Opens the system screen where the user lets Flint reach every folder. */
    @Command
    fun requestAllFilesAccess(invoke: Invoke) {
        if (isGranted()) {
            invoke.resolve(access())
            return
        }
        val intent = Intent(
            Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
            Uri.parse("package:${activity.packageName}"),
        )
        startActivityForResult(invoke, intent, "accessResult")
    }

    @ActivityCallback
    fun accessResult(invoke: Invoke, result: ActivityResult) {
        invoke.resolve(access())
    }

    @Command
    fun pickFolder(invoke: Invoke) {
        startActivityForResult(invoke, Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), "folderResult")
    }

    @ActivityCallback
    fun folderResult(invoke: Invoke, result: ActivityResult) {
        val uri = result.data?.data
        invoke.resolve(JSObject().apply { put("path", uri?.let(::pathOf)) })
    }

    /** "primary:Notes" is /storage/emulated/0/Notes; "1A2B-3C4D:Notes" is on that SD card. */
    private fun pathOf(tree: Uri): String? {
        val id = DocumentsContract.getTreeDocumentId(tree) ?: return null
        val volume = id.substringBefore(':')
        val folder = id.substringAfter(':', "")
        val root = if (volume == "primary") {
            Environment.getExternalStorageDirectory().path
        } else {
            "/storage/$volume"
        }
        return if (folder.isEmpty()) root else "$root/$folder"
    }
}

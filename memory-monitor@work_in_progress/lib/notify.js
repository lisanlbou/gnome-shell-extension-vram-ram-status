// lib/notify.js — asynchronous freedesktop notifications.
//
// Runs inside the GNOME Shell process. Uses the org.freedesktop.Notifications
// D-Bus interface asynchronously, so a slow notification daemon can never block
// the Shell. Failures are swallowed.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Post a system notification. The call is async and non-blocking.
 */
export function notify(title, body) {
    try {
        const connection = Gio.DBus.session;
        const parameters = new GLib.Variant('(susssasa{sv}i)', [
            'memory-monitor', // app_name
            0,                 // replaces_id
            '',                // app_icon
            title,             // summary
            body,              // body
            [],                // actions
            {},                // hints
            -1,                // expire_timeout
        ]);
        connection.call(
            'org.freedesktop.Notifications',
            '/org/freedesktop/Notifications',
            'org.freedesktop.Notifications',
            'Notify',
            parameters,
            new GLib.VariantType('(u)'),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (conn, res) => {
                try {
                    conn.call_finish(res);
                } catch (e) {
                    // Ignore notification delivery failures.
                }
            },
        );
    } catch (e) {
        // Never let a notification failure crash the Shell.
    }
}

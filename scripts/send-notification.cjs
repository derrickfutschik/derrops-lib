#!/usr/bin/env node

/**
 * Send desktop notification using node-notifier
 * Usage: node scripts/send-notification.cjs <title> <message> [sound]
 * Example: node scripts/send-notification.cjs "Tests Passed" "All 56 tests passed" "Glass"
 */

const notifier = require('node-notifier');
const path = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node send-notification.cjs <title> <message> [sound]');
  process.exit(1);
}

const title = args[0];
const message = args[1];
const sound = args[2] || 'Glass'; // Default sound

// Determine icon based on title
let icon;
if (title.includes('❌') || title.includes('Failed')) {
  // Use a red/error icon for failures
  icon = path.join(__dirname, '..', 'node_modules', 'node-notifier', 'vendor', 'mac.noindex', 'terminal-notifier.app', 'Contents', 'Resources', 'Terminal.icns');
} else if (title.includes('✅') || title.includes('Passed')) {
  // Use a green/success icon for passes
  icon = path.join(__dirname, '..', 'node_modules', 'node-notifier', 'vendor', 'mac.noindex', 'terminal-notifier.app', 'Contents', 'Resources', 'Terminal.icns');
}

// Send notification
notifier.notify(
  {
    title: title,
    message: message,
    sound: sound,
    icon: icon,
    timeout: 5, // Notification timeout in seconds
    wait: false, // Don't wait for notification to close
  },
  (err, response) => {
    if (err) {
      console.error('Notification error:', err);
      process.exit(1);
    }
  }
);

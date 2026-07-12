const EventEmitter = require('events');
class AssetFlowEventBus extends EventEmitter {}

// Global instance banaya hai
const eventBus = new AssetFlowEventBus();

// development mode me console log daal rahe hai debug ke liye
if (process.env.NODE_ENV === 'development') {
  const emit = eventBus.emit;
  eventBus.emit = function (eventName, ...args) {
    console.log(`[EventBus] 🔔 Ye event trigger hua: ${eventName}`);
    return emit.apply(this, [eventName, ...args]);
  };
}

module.exports = eventBus;

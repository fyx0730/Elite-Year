const MICROBLOCKS_SERVICE_UUID = 'bb37a001-b922-4018-8e74-e14824b3a638';
const MICROBLOCKS_RX_CHAR_UUID = 'bb37a002-b922-4018-8e74-e14824b3a638';
const MICROBLOCKS_TX_CHAR_UUID = 'bb37a003-b922-4018-8e74-e14824b3a638';

const START_COMMANDS = [
  'start',
  'begin',
  'open',
  'on',
  '1',
  'startlottery',
  '开始',
  '抽奖'
];
const STOP_COMMANDS = ['stop', 'end', 'close', 'off', '0', '停止', '结束'];
const TOGGLE_COMMANDS = ['toggle', 'press', 'button', 'click'];

export function classifyLotteryCommand(text) {
  const cmd = String(text || '')
    .replace(/\0/g, '')
    .replace(/\u00fe/g, '')
    .trim()
    .toLowerCase();
  if (!cmd) {
    return null;
  }
  if (STOP_COMMANDS.includes(cmd)) {
    return 'stop';
  }
  if (START_COMMANDS.includes(cmd)) {
    return 'start';
  }
  if (TOGGLE_COMMANDS.includes(cmd)) {
    return 'toggle';
  }
  return 'toggle';
}

function decodePayload(msgBytes) {
  let payload = msgBytes;
  if (msgBytes[0] === 251 && msgBytes.length >= 6) {
    payload = msgBytes.slice(5);
  } else if (msgBytes.length > 4) {
    payload = msgBytes.slice(4);
  }
  if (payload.length && payload[payload.length - 1] === 254) {
    payload = payload.slice(0, -1);
  }
  return new TextDecoder()
    .decode(payload)
    .replace(/\0/g, '')
    .trim();
}

export class MicroblocksClient {
  constructor({ onMessage, onDisconnected } = {}) {
    this.onMessage = onMessage;
    this.onDisconnected = onDisconnected;
    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.messageBuffer = new Uint8Array();
    this.handleNotifications = this.handleNotifications.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
  }

  get connected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('当前浏览器不支持 Web Bluetooth，请使用 Chrome 打开本页');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [MICROBLOCKS_SERVICE_UUID] }]
    });

    this.disconnect();
    this.device = device;
    device.addEventListener('gattserverdisconnected', this.handleDisconnected);

    this.server = await device.gatt.connect();
    const service = await this.server.getPrimaryService(
      MICROBLOCKS_SERVICE_UUID
    );
    const [, txCharacteristic] = await Promise.all([
      service.getCharacteristic(MICROBLOCKS_RX_CHAR_UUID),
      service.getCharacteristic(MICROBLOCKS_TX_CHAR_UUID)
    ]);

    this.txCharacteristic = txCharacteristic;
    this.messageBuffer = new Uint8Array();
    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener(
      'characteristicvaluechanged',
      this.handleNotifications
    );
  }

  disconnect() {
    if (this.txCharacteristic) {
      this.txCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleNotifications
      );
      this.txCharacteristic = null;
    }
    if (this.device) {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.handleDisconnected
      );
      if (this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = null;
    this.server = null;
    this.messageBuffer = new Uint8Array();
  }

  handleDisconnected() {
    this.txCharacteristic = null;
    this.server = null;
    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  match(filter) {
    const buf = this.messageBuffer;
    const result = [];
    let i = 0;
    const length = buf.length;

    while (i < length) {
      while (i < length && buf[i] !== 250 && buf[i] !== 251) {
        i += 1;
      }
      const bytesRemaining = length - i;
      if (bytesRemaining < 1) {
        break;
      }
      const cmd = buf[i];
      if (cmd === 250 && bytesRemaining >= 3) {
        if (filter === buf[i + 1]) {
          result.push(buf.slice(i, i + 3));
        }
        i += 3;
      } else if (cmd === 251 && bytesRemaining >= 5) {
        const msgLen = 256 * buf[i + 4] + buf[i + 3];
        const end = i + 5 + msgLen;
        if (end > length) {
          this.messageBuffer = buf.slice(i);
          return result;
        }
        if (filter === buf[i + 1]) {
          result.push(buf.slice(i, end));
        }
        i = end;
      } else {
        this.messageBuffer = buf.slice(i);
        return result;
      }
    }
    this.messageBuffer = buf.slice(i);
    return result;
  }

  handleNotifications(event) {
    const msg = new Uint8Array(event.target.value.buffer);
    this.messageBuffer = new Uint8Array([...this.messageBuffer, ...msg]);
    const messages = this.match(27)
      .map(decodePayload)
      .filter(Boolean);
    messages.forEach(text => {
      if (this.onMessage) {
        this.onMessage(text);
      }
    });
  }
}

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Meski namanya "BLEPrinter", modul native ini sebenarnya pakai Bluetooth
// Classic (RFCOMM/SPP) — persis protokol yang dipakai printer struk 80mm
// murah (ESC/POS) di lapangan, BUKAN Bluetooth Low Energy sungguhan.
import { BLEPrinter } from 'react-native-thermal-receipt-printer';

const STORAGE_KEY = 'ge-printer-mac';

export type PairedPrinter = {
  device_name: string;
  inner_mac_address: string;
};

// Modul native Bluetooth cuma ada di build development/produksi (butuh
// expo-dev-client + prebuild) — TIDAK tersedia di Expo Go maupun web.
export function isThermalPrinterAvailable(): boolean {
  return Platform.OS === 'android';
}

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await BLEPrinter.init();
    initialized = true;
  }
}

// Printer harus SUDAH di-pairing dulu lewat menu Bluetooth bawaan Android —
// modul ini cuma bisa daftar & sambung ke perangkat yang sudah ter-pairing
// (Classic Bluetooth SPP tidak scan perangkat baru dari dalam app).
export async function listPairedPrinters(): Promise<PairedPrinter[]> {
  await ensureInit();
  return BLEPrinter.getDeviceList();
}

export async function connectPrinter(macAddress: string): Promise<void> {
  await ensureInit();
  await BLEPrinter.connectPrinter(macAddress);
  await AsyncStorage.setItem(STORAGE_KEY, macAddress);
}

export async function getSavedPrinterMac(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function printReceipt(text: string): Promise<void> {
  await ensureInit();
  const mac = await getSavedPrinterMac();
  if (!mac) throw new Error('Belum ada printer struk yang dipilih. Buka Pengaturan Printer dulu.');
  await BLEPrinter.connectPrinter(mac);
  await BLEPrinter.printText(text, { beep: false, cut: true, encoding: 'UTF8' });
}

import fs from "fs";
import path from "path";

export interface Vehicle {
  id: string;
  condition: "new" | "used";
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  exteriorColor: string;
  interiorColor: string;
  mileage: number;
  priceGbp: number;
  wasPriceGbp?: number;
  fuelType: string;
  mpgCombined?: number;
  rangeMiles?: number;
  transmission: string;
  drivetrain: string;
  features: string[];
  registration: string;
  status: string;
  hpiClear?: boolean;
}

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  phone?: string;
  email?: string;
  interest: string;
  vehicleId?: string;
  notes?: string;
  source: string;
}

export interface Appointment {
  id: string;
  createdAt: string;
  type: "test_drive" | "service";
  customerName: string;
  phone?: string;
  email?: string;
  vehicleId?: string;
  vehicleDescription?: string;
  serviceNeeded?: string;
  requestedDate: string;
  requestedTime: string;
  status: "pending" | "confirmed" | "cancelled";
  notes?: string;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const APPTS_FILE = path.join(DATA_DIR, "appointments.json");
const INVENTORY_FILE = path.resolve("./config/inventory.seed.json");

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

class Store {
  inventory: Vehicle[];
  leads: Lead[];
  appointments: Appointment[];

  constructor() {
    this.inventory = readJsonFile<Vehicle[]>(INVENTORY_FILE, []);
    this.leads = readJsonFile<Lead[]>(LEADS_FILE, []);
    this.appointments = readJsonFile<Appointment[]>(APPTS_FILE, []);
  }

  searchInventory(filters: {
    condition?: string;
    make?: string;
    model?: string;
    bodyStyle?: string;
    fuelType?: string;
    maxPrice?: number;
    minPrice?: number;
    maxMileage?: number;
    minYear?: number;
    keyword?: string;
  }): Vehicle[] {
    const norm = (s: string) => s.toLowerCase().trim();
    return this.inventory.filter((v) => {
      if (v.status !== "available") return false;
      if (filters.condition && norm(v.condition) !== norm(filters.condition)) return false;
      if (filters.make && norm(v.make) !== norm(filters.make)) return false;
      if (filters.model && !norm(v.model).includes(norm(filters.model))) return false;
      if (filters.bodyStyle && norm(v.bodyStyle) !== norm(filters.bodyStyle)) return false;
      if (filters.fuelType && norm(v.fuelType) !== norm(filters.fuelType)) return false;
      if (filters.maxPrice != null && v.priceGbp > filters.maxPrice) return false;
      if (filters.minPrice != null && v.priceGbp < filters.minPrice) return false;
      if (filters.maxMileage != null && v.mileage > filters.maxMileage) return false;
      if (filters.minYear != null && v.year < filters.minYear) return false;
      if (filters.keyword) {
        const haystack = norm(
          `${v.year} ${v.make} ${v.model} ${v.trim} ${v.bodyStyle} ${v.exteriorColor} ${v.fuelType} ${v.features.join(" ")}`
        );
        const words = norm(filters.keyword).split(/\s+/);
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      return true;
    });
  }

  getVehicle(id: string): Vehicle | undefined {
    const wanted = id.toLowerCase().replace(/\s+/g, "");
    return this.inventory.find(
      (v) =>
        v.id.toLowerCase() === wanted ||
        v.registration.toLowerCase().replace(/\s+/g, "") === wanted
    );
  }

  addLead(lead: Omit<Lead, "id" | "createdAt">): Lead {
    const record: Lead = {
      ...lead,
      id: `L${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`,
      createdAt: new Date().toISOString(),
    };
    this.leads.push(record);
    writeJsonFile(LEADS_FILE, this.leads);
    return record;
  }

  addAppointment(appt: Omit<Appointment, "id" | "createdAt" | "status">): Appointment {
    const record: Appointment = {
      ...appt,
      id: `A${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    this.appointments.push(record);
    writeJsonFile(APPTS_FILE, this.appointments);
    return record;
  }
}

export const store = new Store();

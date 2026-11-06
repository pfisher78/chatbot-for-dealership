import Anthropic from "@anthropic-ai/sdk";
import { store, Vehicle } from "../data/store";
import { dealershipConfig, financeEnabled } from "../config";

const baseToolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_inventory",
    description:
      "Search the dealership's live vehicle stock. Call this whenever the customer asks about available vehicles, mentions a budget, a body style (SUV, hatchback, saloon, estate...), a make/model, fuel type (petrol, diesel, hybrid, electric...), or asks 'what have you got'. All prices are in GBP and include VAT. Returns matching vehicles with stock id, price, and key specs. Prefer broad filters first, then narrow.",
    input_schema: {
      type: "object",
      properties: {
        condition: { type: "string", enum: ["new", "used"], description: "New or used vehicles only" },
        make: { type: "string", description: "Vehicle make, e.g. Kia" },
        model: { type: "string", description: "Vehicle model, e.g. Sportage" },
        bodyStyle: { type: "string", description: "SUV, Hatchback, Saloon, Estate, Pickup, etc." },
        fuelType: { type: "string", description: "Petrol, Diesel, Hybrid, or Electric (matched loosely, e.g. 'Petrol' also matches mild hybrids)" },
        maxPrice: { type: "number", description: "Maximum price in GBP" },
        minPrice: { type: "number", description: "Minimum price in GBP" },
        maxMileage: { type: "number", description: "Maximum odometer miles (for used vehicles)" },
        minYear: { type: "number", description: "Earliest model year / registration year to include" },
        keyword: { type: "string", description: "Free-text keyword match against features, colours, trim" }
      }
    }
  },
  {
    name: "get_vehicle_details",
    description:
      "Get full details for one specific vehicle by its stock id (e.g. V1001) or registration plate. Call this when the customer wants more information about a particular vehicle found via search_inventory.",
    input_schema: {
      type: "object",
      properties: {
        vehicleId: { type: "string", description: "Stock id (e.g. V1001) or registration (e.g. YC22 KXR)" }
      },
      required: ["vehicleId"]
    }
  },
  {
    name: "estimate_part_exchange",
    description:
      "Produce a rough part-exchange value range for the customer's current vehicle. Call this when the customer mentions part-exchanging (px) or trading in their car. The result is a preliminary estimate only — a firm offer requires an in-person appraisal and HPI check at the dealership.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Model year / first registration year of the vehicle" },
        make: { type: "string" },
        model: { type: "string" },
        mileage: { type: "number", description: "Current odometer miles" },
        condition: {
          type: "string",
          enum: ["excellent", "good", "fair", "poor"],
          description: "Overall condition as described by the customer. Default good."
        }
      },
      required: ["year", "make", "model", "mileage"]
    }
  },
  {
    name: "schedule_test_drive",
    description:
      "Book a test drive appointment for a specific vehicle. Only call this after you have the customer's name, a contact method (phone or email), the vehicle, and a preferred date and time. The appointment is created as 'pending' and a team member confirms it. Remind the customer to bring their full UK driving licence.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        phone: { type: "string", description: "Customer phone number" },
        email: { type: "string", description: "Customer email address" },
        vehicleId: { type: "string", description: "Stock id of the vehicle, if known" },
        vehicleDescription: { type: "string", description: "Year/make/model if no stock id" },
        requestedDate: { type: "string", description: "Requested date, e.g. 2026-07-18 or 'Saturday'" },
        requestedTime: { type: "string", description: "Requested time, e.g. 2:00pm" },
        notes: { type: "string", description: "Anything else the team should know" }
      },
      required: ["customerName", "requestedDate", "requestedTime"]
    }
  },
  {
    name: "schedule_service",
    description:
      "Book a service department appointment (service, MOT, tyres, brakes, diagnostics, recall work, etc.). Only call this after you have the customer's name, a contact method, the vehicle being serviced, what work is needed, and a preferred date and time.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        vehicleDescription: { type: "string", description: "Year/make/model (and registration if given) of the vehicle being serviced" },
        serviceNeeded: { type: "string", description: "What work is needed, e.g. MOT, full service, brake noise" },
        requestedDate: { type: "string" },
        requestedTime: { type: "string" },
        notes: { type: "string" }
      },
      required: ["customerName", "vehicleDescription", "serviceNeeded", "requestedDate", "requestedTime"]
    }
  },
  {
    name: "capture_lead",
    description:
      "Save the customer's contact information as a sales lead so a team member can follow up. Call this when the customer shares contact info and wants follow-up, a quote, stock alerts, or a callback — but is not booking an appointment right now. Never invent contact details; only use what the customer explicitly provided.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        interest: { type: "string", description: "What the customer is interested in, in one sentence" },
        vehicleId: { type: "string", description: "Stock id if a specific vehicle" },
        notes: { type: "string" }
      },
      required: ["name", "interest"]
    }
  },
  {
    name: "get_dealership_info",
    description:
      "Get dealership opening hours, address, phone, current special offers, and pricing basics (VAT-inclusive pricing, admin fee). Call this when the customer asks when the dealership is open, where it is, how to contact it, about fees, or about current deals and promotions.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["hours", "location", "contact", "offers", "pricing", "all"],
          description: "Which information to retrieve. Default all."
        }
      }
    }
  }
];

const financeTool: Anthropic.Tool = {
  name: "get_finance_information",
  description:
    "Get the dealership's approved consumer finance information: the FCA credit-broker disclosure and the dealer's signed-off representative example. Call this whenever the customer asks about finance, monthly payments, PCP/HP, deposits, or APR. You must present the representative example EXACTLY as returned, clearly labelled 'Representative example', together with the disclosure. NEVER calculate or improvise personalised monthly payments, APRs, or finance figures yourself — personalised quotes can only come from the dealership's finance team after a credit application.",
  input_schema: {
    type: "object",
    properties: {}
  }
};

// The finance tool is only exposed to the model when the dealer has signed
// off (FCA compliance). With it absent, the model has no way to produce
// finance figures and follows the system-prompt referral policy instead.
export const toolDefinitions: Anthropic.Tool[] = financeEnabled
  ? [...baseToolDefinitions, financeTool]
  : baseToolDefinitions;

function summarizeVehicle(v: Vehicle) {
  return {
    id: v.id,
    title: `${v.year} ${v.make} ${v.model} ${v.trim}`,
    condition: v.condition,
    bodyStyle: v.bodyStyle,
    priceGbp: v.priceGbp,
    wasPriceGbp: v.wasPriceGbp,
    vatIncluded: true,
    mileage: v.mileage,
    fuelType: v.fuelType,
    economy: v.fuelType === "Electric" ? `${v.rangeMiles ?? "?"} miles range (WLTP)` : `${v.mpgCombined ?? "?"} mpg combined`,
    transmission: v.transmission,
    exteriorColour: v.exteriorColor,
    registration: v.registration,
    hpiClear: v.hpiClear,
    topFeatures: v.features.slice(0, 4)
  };
}

export function executeTool(name: string, input: Record<string, unknown>): string {
  try {
    switch (name) {
      case "search_inventory": {
        const filters = { ...(input as Parameters<typeof store.searchInventory>[0]) };
        // Loose fuel matching: "Petrol" should include mild hybrids, etc.
        if (filters.fuelType) {
          const wanted = String(filters.fuelType).toLowerCase();
          const results = store
            .searchInventory({ ...filters, fuelType: undefined })
            .filter((v) => v.fuelType.toLowerCase().includes(wanted));
          if (results.length === 0) {
            return JSON.stringify({
              matches: 0,
              message:
                "No vehicles matched those filters. Suggest loosening a filter (price, condition, body style) or offer to capture a lead so the team can alert the customer when a match arrives."
            });
          }
          return JSON.stringify({ matches: results.length, vehicles: results.map(summarizeVehicle) });
        }
        const results = store.searchInventory(filters);
        if (results.length === 0) {
          return JSON.stringify({
            matches: 0,
            message:
              "No vehicles matched those filters. Suggest loosening a filter (price, condition, body style) or offer to capture a lead so the team can alert the customer when a match arrives."
          });
        }
        return JSON.stringify({ matches: results.length, vehicles: results.map(summarizeVehicle) });
      }

      case "get_vehicle_details": {
        const v = store.getVehicle(String(input.vehicleId ?? ""));
        if (!v) return JSON.stringify({ error: `No vehicle found with stock id or registration '${input.vehicleId}'.` });
        return JSON.stringify({
          ...v,
          pricingNote: "Price includes VAT. " + dealershipConfig.dealership.pricing.adminFeeNote
        });
      }

      case "get_finance_information": {
        const fin = dealershipConfig.dealership.financing;
        if (!financeEnabled || !fin.representativeExample) {
          return JSON.stringify({
            financeDiscussionEnabled: false,
            message:
              "Finance figures cannot be discussed by this assistant. Refer the customer to the dealership's finance team, who can provide a personalised, regulated quote."
          });
        }
        return JSON.stringify({
          financeDiscussionEnabled: true,
          instructions:
            "Present the representative example exactly as given, labelled 'Representative example'. Include the disclosure. Do not adjust any figure. For a personalised quote, the customer must speak to the finance team — offer to capture their details or book them in.",
          fcaDisclosure: fin.fcaDisclosure,
          representativeExample: fin.representativeExample
        });
      }

      case "estimate_part_exchange": {
        const year = Number(input.year);
        const mileage = Number(input.mileage);
        const currentYear = new Date().getFullYear();
        if (!Number.isFinite(year) || year < 1980 || year > currentYear + 1) {
          return JSON.stringify({ error: "A valid model year is required." });
        }
        // Simple heuristic model: baseline value depreciated by age and mileage,
        // adjusted by stated condition. Placeholder for a real UK valuation API
        // (CAP HPI / Auto Trader Retail Check) integration.
        const age = Math.max(0, currentYear - year);
        const baseline = 26000 * Math.pow(0.84, age);
        const mileagePenalty = Math.max(0.55, 1 - Math.max(0, mileage - age * 10000) / 160000);
        const conditionFactor =
          { excellent: 1.08, good: 1.0, fair: 0.85, poor: 0.65 }[String(input.condition || "good")] ?? 1.0;
        const mid = Math.max(300, baseline * mileagePenalty * conditionFactor);
        const low = Math.round((mid * 0.9) / 100) * 100;
        const high = Math.round((mid * 1.1) / 100) * 100;
        return JSON.stringify({
          vehicle: `${year} ${input.make} ${input.model}`,
          mileage,
          condition: input.condition || "good",
          estimatedRangeGbp: { low, high },
          disclaimer:
            "Preliminary estimate only — a firm offer requires an in-person appraisal and HPI check, and assumes no outstanding finance. Encourage the customer to bring the vehicle in or book an appointment."
        });
      }

      case "schedule_test_drive": {
        if (!input.phone && !input.email) {
          return JSON.stringify({
            error: "A phone number or email is required to book. Ask the customer for one before booking."
          });
        }
        const vehicle = input.vehicleId ? store.getVehicle(String(input.vehicleId)) : undefined;
        const appt = store.addAppointment({
          type: "test_drive",
          customerName: String(input.customerName),
          phone: input.phone ? String(input.phone) : undefined,
          email: input.email ? String(input.email) : undefined,
          vehicleId: vehicle?.id,
          vehicleDescription:
            vehicle != null
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`
              : input.vehicleDescription
              ? String(input.vehicleDescription)
              : undefined,
          requestedDate: String(input.requestedDate),
          requestedTime: String(input.requestedTime),
          notes: input.notes ? String(input.notes) : undefined
        });
        return JSON.stringify({
          booked: true,
          confirmationId: appt.id,
          status: "pending — a team member will confirm shortly",
          reminder: "Please bring your full UK driving licence to the test drive.",
          appointment: appt
        });
      }

      case "schedule_service": {
        if (!input.phone && !input.email) {
          return JSON.stringify({
            error: "A phone number or email is required to book. Ask the customer for one before booking."
          });
        }
        const appt = store.addAppointment({
          type: "service",
          customerName: String(input.customerName),
          phone: input.phone ? String(input.phone) : undefined,
          email: input.email ? String(input.email) : undefined,
          vehicleDescription: String(input.vehicleDescription),
          serviceNeeded: String(input.serviceNeeded),
          requestedDate: String(input.requestedDate),
          requestedTime: String(input.requestedTime),
          notes: input.notes ? String(input.notes) : undefined
        });
        return JSON.stringify({
          booked: true,
          confirmationId: appt.id,
          status: "pending — the service department will confirm shortly",
          appointment: appt
        });
      }

      case "capture_lead": {
        const lead = store.addLead({
          name: String(input.name),
          phone: input.phone ? String(input.phone) : undefined,
          email: input.email ? String(input.email) : undefined,
          interest: String(input.interest),
          vehicleId: input.vehicleId ? String(input.vehicleId) : undefined,
          notes: input.notes ? String(input.notes) : undefined,
          source: "chatbot"
        });
        return JSON.stringify({
          saved: true,
          leadId: lead.id,
          message: "Lead saved. A team member will follow up during opening hours."
        });
      }

      case "get_dealership_info": {
        const d = dealershipConfig.dealership;
        const topic = String(input.topic || "all");
        const info: Record<string, unknown> = {};
        if (topic === "hours" || topic === "all") info.openingHours = d.hours;
        if (topic === "location" || topic === "all") info.address = d.address;
        if (topic === "contact" || topic === "all") {
          info.phone = d.phone;
          info.email = d.email;
          info.website = d.website;
        }
        if (topic === "offers" || topic === "all") info.specialOffers = d.specialOffers;
        if (topic === "pricing" || topic === "all") {
          info.pricing = {
            vatIncluded: d.pricing.vatIncluded,
            adminFeeGbp: d.pricing.adminFeeGbp,
            note: d.pricing.adminFeeNote
          };
        }
        return JSON.stringify(info);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: `Tool execution failed: ${(err as Error).message}` });
  }
}

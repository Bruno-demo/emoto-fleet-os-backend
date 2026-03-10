import { z } from 'zod';

const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  user: z.object({
    id: z.string().min(1),
    fleetId: z.string().min(1),
    role: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
  }),
});

const bikeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
});

const paginatedBikesSchema = z.object({
  data: z.array(bikeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().positive(),
});

const expectedFleetOneLabels = ['Bike-001', 'Bike-002', 'Bike-003'];
const expectedFleetTwoLabels = ['North-001', 'North-002'];

interface AdminSession {
  email: string;
  fleetId: string;
  accessToken: string;
  bikeIds: string[];
  bikeLabels: string[];
}

// Sends JSON requests and fails with actionable detail on non-2xx responses.
async function requestJson<T>(
  input: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const response = await fetch(input, init);
  const rawText = await response.text();
  const parsedBody = rawText.length > 0 ? tryParseJson(rawText) : null;

  if (!response.ok) {
    throw new Error(
      `Request failed ${response.status} ${response.statusText} for ${input}: ${rawText}`,
    );
  }

  return schema.parse(parsedBody);
}

// Parses a JSON string and throws a concise error when the payload is malformed.
function tryParseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Expected JSON response but received invalid payload: ${message}`);
  }
}

// Authenticates with the seeded admin account and returns a usable session.
async function loginAndLoadBikes(
  baseUrl: string,
  email: string,
  password: string,
): Promise<AdminSession> {
  const loginResponse = await requestJson(
    `${baseUrl}/auth/login`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
    loginResponseSchema,
  );

  const bikesResponse = await requestJson(
    `${baseUrl}/bikes?page=1&pageSize=100`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${loginResponse.accessToken}`,
      },
    },
    paginatedBikesSchema,
  );

  return {
    email,
    fleetId: loginResponse.user.fleetId,
    accessToken: loginResponse.accessToken,
    bikeIds: bikesResponse.data.map((bike) => bike.id),
    bikeLabels: bikesResponse.data.map((bike) => bike.label).sort(),
  };
}

// Confirms the fleet sees only its expected labels and not the other tenant's labels.
function assertFleetLabels(
  session: AdminSession,
  expectedLabels: string[],
  forbiddenLabels: string[],
): void {
  const missingLabels = expectedLabels.filter(
    (label) => !session.bikeLabels.includes(label),
  );
  const leakedLabels = forbiddenLabels.filter((label) =>
    session.bikeLabels.includes(label),
  );

  if (missingLabels.length > 0 || leakedLabels.length > 0) {
    throw new Error(
      [
        `Unexpected bike list for ${session.email}`,
        `expected labels: ${expectedLabels.join(', ')}`,
        `actual labels: ${session.bikeLabels.join(', ')}`,
        missingLabels.length > 0 ? `missing labels: ${missingLabels.join(', ')}` : null,
        leakedLabels.length > 0 ? `leaked labels: ${leakedLabels.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }
}

// Requests a foreign-fleet bike directly and ensures the API rejects access.
async function assertBikeAccessBlocked(
  baseUrl: string,
  session: AdminSession,
  foreignBikeId: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/bikes/${foreignBikeId}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (response.status !== 403) {
    const rawText = await response.text();
    throw new Error(
      `Expected 403 when ${session.email} requests foreign bike ${foreignBikeId}, received ${response.status}: ${rawText}`,
    );
  }
}

// Runs both admin flows and prints a compact success summary for local smoke testing.
async function main(): Promise<void> {
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const fleetOneEmail = process.env.SMOKE_FLEET_ONE_ADMIN_EMAIL ?? 'admin@demo.emoto';
  const fleetOnePassword =
    process.env.SMOKE_FLEET_ONE_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const fleetTwoEmail =
    process.env.SMOKE_FLEET_TWO_ADMIN_EMAIL ?? 'admin@north.demo.emoto';
  const fleetTwoPassword =
    process.env.SMOKE_FLEET_TWO_ADMIN_PASSWORD ?? 'FleetTwo123!';

  const [fleetOneSession, fleetTwoSession] = await Promise.all([
    loginAndLoadBikes(baseUrl, fleetOneEmail, fleetOnePassword),
    loginAndLoadBikes(baseUrl, fleetTwoEmail, fleetTwoPassword),
  ]);

  assertFleetLabels(
    fleetOneSession,
    expectedFleetOneLabels,
    expectedFleetTwoLabels,
  );
  assertFleetLabels(
    fleetTwoSession,
    expectedFleetTwoLabels,
    expectedFleetOneLabels,
  );

  await assertBikeAccessBlocked(baseUrl, fleetOneSession, fleetTwoSession.bikeIds[0]);
  await assertBikeAccessBlocked(baseUrl, fleetTwoSession, fleetOneSession.bikeIds[0]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        fleetOne: {
          email: fleetOneSession.email,
          fleetId: fleetOneSession.fleetId,
          bikeLabels: fleetOneSession.bikeLabels,
        },
        fleetTwo: {
          email: fleetTwoSession.email,
          fleetId: fleetTwoSession.fleetId,
          bikeLabels: fleetTwoSession.bikeLabels,
        },
        blockedForeignBikeAccess: true,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

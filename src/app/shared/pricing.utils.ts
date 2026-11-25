export function calculateNightCount(checkIn: string | null | undefined, checkOut: string | null | undefined): number | null {
  const checkInDate = parseDate(checkIn);
  const checkOutDate = parseDate(checkOut);
  if (checkInDate === null || checkOutDate === null || checkOutDate <= checkInDate) return null;

  return (checkOutDate - checkInDate) / (24 * 60 * 60 * 1000);
}

export function addNightsToDate(dateValue: string, nights: number): string {
  const datePart = dateValue.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match || parseDate(datePart) === null || !Number.isInteger(nights) || nights < 1) return '';

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + nights));
  return date.toISOString().slice(0, 10);
}

function parseDate(dateValue: string | null | undefined): number | null {
  if (!dateValue) return null;
  const datePart = dateValue.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const date = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) return null;
  return date.getTime();
}
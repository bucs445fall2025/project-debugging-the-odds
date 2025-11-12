export const isValidEmail = (email: string) => /.+@.+\..+/.test(email);
export const isStrongPassword = (pw: string) => /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/.test(pw);

export function calculateAge(dateString: string) {
  const birth = new Date(dateString);
  if (isNaN(birth.getTime())) return NaN;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

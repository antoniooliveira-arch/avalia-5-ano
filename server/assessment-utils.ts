export type ObjectiveAnswer = {
  expected: string;
  selected?: string | null;
  points?: number;
};

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

export function calculateObjectiveResult(items: ObjectiveAnswer[]) {
  const totalQuestions = items.length;
  const totalPoints = items.reduce((sum, item) => sum + (item.points ?? 1), 0);
  const correctAnswers = items.reduce((sum, item) => {
    const selected = item.selected?.trim().toLowerCase() ?? "";
    return sum + (selected !== "" && selected === item.expected.trim().toLowerCase() ? 1 : 0);
  }, 0);
  const earnedPoints = items.reduce((sum, item) => {
    const selected = item.selected?.trim().toLowerCase() ?? "";
    const isCorrect = selected !== "" && selected === item.expected.trim().toLowerCase();
    return sum + (isCorrect ? item.points ?? 1 : 0);
  }, 0);
  const wrongAnswers = Math.max(totalQuestions - correctAnswers, 0);
  const percentage = totalPoints ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;
  return { totalQuestions, totalPoints, earnedPoints, correctAnswers, wrongAnswers, percentage };
}

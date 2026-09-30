import { SavingStatus } from "./types";

export const determineStatus = (
    amount: number | string,
    goal: number | string | null | undefined,
    targetDate: string | null | undefined,
    createdAt: string
): SavingStatus => {
    const numericAmount = Number(amount);

    // No goal set: there's nothing to be behind on or complete against.
    if (goal === null || goal === undefined) {
        return "active";
    }

    const numericGoal = Number(goal);

    if (numericAmount >= numericGoal) {
        return "completed";
    }

    // No deadline set: can't fall behind schedule, so just track completion.
    if (!targetDate) {
        return "active";
    }

    const today = new Date();
    const target = new Date(targetDate);
    const created = new Date(createdAt);

    if (target < today) {
        return "atRisk";
    }

    const totalDays = Math.max(1, Math.ceil((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(1, Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));


    const expectedDailySavings = numericGoal / totalDays;
    const actualDailySavings = numericAmount / daysElapsed;

    if (actualDailySavings < expectedDailySavings * 0.7) {
        return "atRisk";
    }

    return "active";
}

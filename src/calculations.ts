import type { TideExtreme } from './types.js';

/**
 * Calculate tide height using the Rule of Twelfths.
 * This is a more robust method that handles edge cases better than simple interpolation.
 */
export function approximateTideHeightAt(extremes: TideExtreme[], time: Date): number | null {
  const sorted = extremes.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const prev = sorted.filter(h => new Date(h.time) <= time).at(-1);
  const next = sorted.filter(h => new Date(h.time) >= time).at(0);

  // If we don't have both prev and next, try to find closest high and low
  if (!prev || !next) {
    // Fallback: find closest high and low tide
    const highs = sorted.filter(e => e.type === 'High');
    const lows = sorted.filter(e => e.type === 'Low');
    
    if (highs.length === 0 || lows.length === 0) {
      // Cannot calculate, return null instead of throwing
      return null;
    }
    
    // Find closest high and low to current time
    const closestHigh = highs.reduce((closest, h) => 
      Math.abs(new Date(h.time).getTime() - time.getTime()) < Math.abs(new Date(closest.time).getTime() - time.getTime()) ? h : closest
    );
    const closestLow = lows.reduce((closest, l) => 
      Math.abs(new Date(l.time).getTime() - time.getTime()) < Math.abs(new Date(closest.time).getTime() - time.getTime()) ? l : closest
    );
    
    return calculateTideHeightUsingTwelfths(
      closestHigh.value,
      closestLow.value,
      time,
      new Date(closestHigh.time),
      new Date(closestLow.time)
    );
  }

  // Use Rule of Twelfths with prev and next extremes
  const highTide = prev.type === 'High' ? prev : next;
  const lowTide = prev.type === 'Low' ? prev : next;

  return calculateTideHeightUsingTwelfths(
    highTide.value,
    lowTide.value,
    time,
    new Date(highTide.time),
    new Date(lowTide.time)
  );
}

/**
 * Calculate tide height using the Rule of Twelfths.
 * The rule states that in the first hour, the tide rises/falls 1/12 of its range,
 * in the second hour 2/12, third hour 3/12, fourth hour 3/12, fifth hour 2/12, sixth hour 1/12.
 */
function calculateTideHeightUsingTwelfths(
  highTideHeight: number,
  lowTideHeight: number,
  currentTime: Date,
  highTideTime: Date,
  lowTideTime: Date
): number {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const highTideMinutes = highTideTime.getHours() * 60 + highTideTime.getMinutes();
  const lowTideMinutes = lowTideTime.getHours() * 60 + lowTideTime.getMinutes();

  // Determine if tide is rising or falling and set calculation parameters
  let isRising = false;
  let startHeight: number, endHeight: number, startMinutes: number, endMinutes: number;

  if (lowTideMinutes <= currentMinutes && currentMinutes <= highTideMinutes) {
    // We are in a rising tide cycle (low to high)
    isRising = true;
    startHeight = lowTideHeight;
    endHeight = highTideHeight;
    startMinutes = lowTideMinutes;
    endMinutes = highTideMinutes;
  } else {
    // We are in a falling tide cycle (high to low)
    startHeight = highTideHeight;
    endHeight = lowTideHeight;
    startMinutes = highTideMinutes;
    // Handle case where low tide is on the next day (midnight overlap)
    endMinutes = lowTideMinutes + (lowTideMinutes < highTideMinutes ? 1440 : 0);
  }

  // Calculate total duration of this tide cycle and the total height change
  const tideCycleDuration = Math.abs(endMinutes - startMinutes);
  const tideChange = Math.abs(endHeight - startHeight);

  // Calculate elapsed time since start of cycle, handling day wraparound
  let elapsedTime = currentMinutes - startMinutes;
  if (elapsedTime < 0) elapsedTime += 1440; // Add minutes in a day (24*60) if negative

  // Calculate one twelfth of the total tide change
  const twelfth = tideChange / 12;
  let heightChange: number;

  // Apply the Rule of Twelfths based on elapsed time
  if (tideCycleDuration === 0) {
    heightChange = 0;
  } else if (elapsedTime <= tideCycleDuration / 6) {
    // First hour: 1/12 of the range
    heightChange = twelfth * Math.ceil(elapsedTime / (tideCycleDuration / 12));
  } else if (elapsedTime <= 2 * tideCycleDuration / 6) {
    // Second hour: 2/12 of the range (total 3/12)
    heightChange = twelfth * 2 + twelfth * Math.ceil((elapsedTime - tideCycleDuration / 6) / (tideCycleDuration / 12));
  } else if (elapsedTime <= 3 * tideCycleDuration / 6) {
    // Third hour: 3/12 of the range (total 6/12)
    heightChange = twelfth * 5;
  } else if (elapsedTime <= 4 * tideCycleDuration / 6) {
    // Fourth hour: 3/12 of the range (total 9/12)
    heightChange = twelfth * 8;
  } else if (elapsedTime <= 5 * tideCycleDuration / 6) {
    // Fifth hour: 2/12 of the range (total 11/12)
    heightChange = twelfth * 10;
  } else {
    // Sixth hour: 1/12 of the range (total 12/12)
    heightChange = tideChange;
  }

  // Return the final calculated height based on whether tide is rising or falling
  const result = isRising ? startHeight + heightChange : startHeight - heightChange;
  return parseFloat(result.toFixed(3));
}

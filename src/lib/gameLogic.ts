export type TambolaTicket = (number | null)[][];

export function getTicket(): TambolaTicket {
  const ticket: TambolaTicket = Array.from({ length: 3 }, () => Array(9).fill(null));
  
  for (let row = 0; row < 3; row++) {
    const cols = getRandomIndices(9, 5);
    for (const col of cols) {
      ticket[row][col] = 0; 
    }
  }

  for (let col = 0; col < 9; col++) {
    const numbersInCol = [];
    for (let row = 0; row < 3; row++) {
      if (ticket[row][col] !== null) {
        numbersInCol.push(row);
      }
    }
    
    if (numbersInCol.length > 0) {
      const min = col * 10 + 1;
      const max = (col + 1) * 10;
      const colNumbers = getRandomNumbers(min, max, numbersInCol.length);
      
      numbersInCol.forEach((row, index) => {
        ticket[row][col] = colNumbers[index];
      });
    }
  }

  return ticket;
}

function getRandomIndices(max: number, count: number): number[] {
  const indices = Array.from({ length: max }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
}

function getRandomNumbers(min: number, max: number, count: number): number[] {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.slice(0, count).sort((a, b) => a - b);
}

export type ClaimType =
  | 'EARLY_FIVE'
  | 'FOUR_CORNERS'
  | 'FIRST_ROW'
  | 'MIDDLE_ROW'
  | 'LAST_ROW'
  | 'BLOCK_LEFT'
  | 'BLOCK_MIDDLE'
  | 'BLOCK_RIGHT'
  | 'FULL_HOUSE';

export const CLAIM_POINTS: Record<ClaimType, number> = {
  EARLY_FIVE:   5,
  FOUR_CORNERS: 10,
  FIRST_ROW:    15,
  MIDDLE_ROW:   15,
  LAST_ROW:     15,
  BLOCK_LEFT:   20,
  BLOCK_MIDDLE: 20,
  BLOCK_RIGHT:  20,
  FULL_HOUSE:   50,
};

export const TOTAL_POINTS = Object.values(CLAIM_POINTS).reduce((a, b) => a + b, 0);

export function validateClaim(ticket: TambolaTicket, calledNumbers: Set<number>, claimType: ClaimType): boolean {
  const getRowNumbers = (rowIndex: number): number[] =>
    ticket[rowIndex].filter((num): num is number => num !== null);

  const getBlockNumbers = (colStart: number, colEnd: number): number[] =>
    ticket.flatMap(row => row.slice(colStart, colEnd).filter((n): n is number => n !== null));

  const getAllNumbers = (): number[] =>
    ticket.flat().filter((num): num is number => num !== null);

  const isSubset = (subset: number[], superset: Set<number>): boolean =>
    subset.every(num => superset.has(num));

  switch (claimType) {
    case 'EARLY_FIVE': {
      const allNums = getAllNumbers();
      return allNums.filter(num => calledNumbers.has(num)).length >= 5;
    }
    case 'FOUR_CORNERS': {
      const topRow = getRowNumbers(0);
      const bottomRow = getRowNumbers(2);
      if (topRow.length === 0 || bottomRow.length === 0) return false;
      const corners = [topRow[0], topRow[topRow.length - 1], bottomRow[0], bottomRow[bottomRow.length - 1]];
      return isSubset(corners, calledNumbers);
    }
    case 'FIRST_ROW':    return isSubset(getRowNumbers(0), calledNumbers);
    case 'MIDDLE_ROW':   return isSubset(getRowNumbers(1), calledNumbers);
    case 'LAST_ROW':     return isSubset(getRowNumbers(2), calledNumbers);
    case 'BLOCK_LEFT':   return isSubset(getBlockNumbers(0, 3), calledNumbers);
    case 'BLOCK_MIDDLE': return isSubset(getBlockNumbers(3, 6), calledNumbers);
    case 'BLOCK_RIGHT':  return isSubset(getBlockNumbers(6, 9), calledNumbers);
    case 'FULL_HOUSE':   return isSubset(getAllNumbers(), calledNumbers);
    default:             return false;
  }
}

export function checkWinner(ticket: TambolaTicket, calledNumbers: Set<number>): boolean {
  for (let row = 0; row < 3; row++) {
    let rowMatched = true;
    for (let col = 0; col < 9; col++) {
      const num = ticket[row][col];
      if (num !== null && !calledNumbers.has(num)) {
        rowMatched = false;
        break;
      }
    }
    if (rowMatched) return true;
  }
  return false;
}

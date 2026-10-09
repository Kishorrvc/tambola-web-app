import { getTicket, checkWinner } from './gameLogic';

describe('Tambola Game Logic', () => {
  test('generates a valid ticket structure', () => {
    const ticket = getTicket();
    expect(ticket).toHaveLength(3);
    ticket.forEach(row => {
      expect(row).toHaveLength(9);
      const filledCount = row.filter(cell => cell !== null).length;
      expect(filledCount).toBe(5);
    });
  });

  test('detects a winner correctly', () => {
    const ticket = getTicket();
    const calledNumbers = new Set<number>();
    
    // Call all numbers for the first row
    ticket[0].forEach(num => {
      if (num !== null) calledNumbers.add(num);
    });
    
    expect(checkWinner(ticket, calledNumbers)).toBe(true);
  });
});

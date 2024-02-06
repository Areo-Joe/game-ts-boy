export function allOnes(bitLength: number) {
  return (1 << bitLength) - 1;
}

export function assertEven(x: number) {
  if (x % 2 !== 0) {
    throw new Error(`${x} is not even!`);
  }
}

export function signedExtend(
  numToBeExtended: number,
  originBitLength: number,
  targetBitLength: number
) {
  const isNegative = (numToBeExtended & (1 << (originBitLength - 1))) !== 0;
  if (isNegative) {
    return (
      numToBeExtended |
      (((1 << targetBitLength) - 1) & ~((1 << originBitLength) - 1))
    );
  } else {
    return numToBeExtended;
  }
}

export function parseAsSigned(val: number, bitLength: number) {
  const allOnes = (1 << bitLength) - 1;

  const lastBit = ((1 << (bitLength - 1)) & val) >> (bitLength - 1);
  if (lastBit === 1) {
    return -((~val + 1) & allOnes);
  } else if (lastBit === 0) {
    return val & ((1 << bitLength) - 1);
  } else {
    throw new Error('Bug when parsing!');
  }
}

export function addWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Add,
    BitLength.OneByte,
    left,
    ...rights
  );
}

export function minusWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Minus,
    BitLength.OneByte,
    left,
    ...rights
  );
}

export function andWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.And,
    BitLength.OneByte,
    left,
    ...rights
  );
}

export function xorWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Xor,
    BitLength.OneByte,
    left,
    ...rights
  );
}

export function orWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Or,
    BitLength.OneByte,
    left,
    ...rights
  );
}

export function addWithDoubleByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Add,
    BitLength.DoubleByte,
    left,
    ...rights
  );
}

export function minusWithDoubleByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Minus,
    BitLength.DoubleByte,
    left,
    ...rights
  );
}

export function performOperationOnOperandsWithBitLength(
  operation: Operation,
  bitLength: number,
  left: number,
  ...rights: number[]
) {
  const allOnes = (1 << bitLength) - 1;
  let result = left & allOnes;

  switch (operation) {
    case Operation.Add:
      rights.forEach((right) => {
        result = ((right & allOnes) + result) & allOnes;
      });
      break;
    case Operation.Minus:
      rights.forEach((right) => {
        result = (result - (right & allOnes)) & allOnes;
      });
      break;
    case Operation.And:
      rights.forEach((right) => {
        result = result & (right & allOnes);
      });
      break;
    case Operation.Xor:
      rights.forEach((right) => {
        result = result ^ (right & allOnes);
      });
      break;
    case Operation.Or:
      rights.forEach((right) => {
        result = result | (right & allOnes);
      });
      break;
    default:
      throw new Error('perform operation: not implemented!');
  }

  return result;
}

export function setBit(val: number, bitIndex: number, bit: 1 | 0) {
  return (val & ~(1 << bitIndex)) | (bit << bitIndex);
}

export function getBit(val: number, bitIndex: number) {
  return (val & (1 << bitIndex)) >> bitIndex;
}

export function getLastBit(val: number, bitLength: number) {
  return getBit(val, bitLength - 1);
}

export function getFirstBit(val: number) {
  return getBit(val, 0);
}

export function lowerByteOfDoubleByte(val: number): number {
  return val & 0xff;
}

export function higherByteOfDoubleByte(val: number): number {
  return (val & 0xff00) >> 8;
}

export enum Operation {
  Add,
  Minus,
  And,
  Xor,
  Or,
}

export enum BitLength {
  OneByte = 8,
  DoubleByte = 16,
}

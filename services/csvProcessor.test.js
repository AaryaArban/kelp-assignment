const { setNestedProperty, buildNestedObject } = require('./csvProcessor');

describe('setNestedProperty', () => {
  it('should create a simple nested object', () => {
    const obj = {};
    setNestedProperty(obj, ['name', 'firstName'], 'John');
    expect(obj).toEqual({ name: { firstName: 'John' } });
  });

  it('should handle infinitely deep nesting', () => {
    const obj = {};
    setNestedProperty(obj, ['a', 'b', 'c', 'd', 'e'], 'deep');
    expect(obj).toEqual({ a: { b: { c: { d: { e: 'deep' } } } } });
  });
});

describe('buildNestedObject', () => {
  it('should parse a line into a nested object and infer types', () => {
    const headers = ['name.firstName', 'name.lastName', 'age', 'gender'];
    const values = ['Jane', 'Doe', '30', 'female'];

    const result = buildNestedObject(headers, values);

    expect(result).toEqual({
      name: { firstName: 'Jane', lastName: 'Doe' },
      age: 30, // <-- Note: this should be a number
      gender: 'female'
    });
  });
});
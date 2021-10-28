
# Change Log
All notable changes to this project will be documented in this file.

## [1.1.0] - 2021-10-28

### Added
* Extra Type checking for struct type members
* Added Return Types for internal functions
### Changed
* Extra Type checking may break the earlier code
```typescript
var Test = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ]);
//earlier to add member variable of type struct Test. the way of defining was
var TestEmbedded = Struct.Create([
    {name: 'arrTest', type: 'struct[2]', val: Struct.ArrayOf(Test, 2)},
    {name: 'anotherArr', type: 'struct[2]', val: [new Test(), new Test()]},
    {name: 'yetAnotherMember', type: 'struct', val: [new Test(), new Test()]}
])

//now it should be written as
var TestEmbedded = Struct.Create([
    {name: 'arrTest', type: `${Test.type}[2]`, val: Struct.ArrayOf(Test, 2)},
    {name: 'anotherArr', type: `${Test.type}[2]`, val: [new Test(), new Test()]},
    {name: 'yetAnotherMember', type: Test.type, val: [new Test(), new Test()]}
])
```
### Fixed

## [1.0.0] - 2021-10-25

First Release

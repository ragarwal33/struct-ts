struct-ts

Create C/C++ Style struct in Typescript.

Installation
------------
    npm install struct-ts

Supports
--------
1. Padding
2. constant size array as member
3. Dynamic size array as last member
4. Serialization/Deserialiation
5. Easy member access
6. Can embed the created structure into another structure

Usage
-----

    Definition of C Struct
    struct Test {
        char x;
        short y;
        int z;
        double w;
    }

    Definition in struct-ts
    var Test = Struct.Create([
        {name: 'x', type: 'char', val: 1},
        {name: 'y', type: 'short', val: 2},
        {name: 'z', type: 'int', val: 3},
        {name: 'w', type: 'double', val: 4.0},
    ]);

    //instantiate object of struct Test
    var instance = new Test();  //this will create instance with the default value specified while creating the definition
    Or
    var instance = new Test ({x: 2, z: 5}); //this will override the default value of x and z with the new values provided

This will create a Test class having abi compatibility with the C Struct for default packing size of 8 bytes

The full definition of Struct.Create is <br>
<code>
    Create(mems: MemberDefinition[], memfns?: MemberFunctionObject, packing?: number): typeof Struct

    Here mems is the member of the structs,
    memfns is optional function that the struct object will have, packing is structure packing size (default is 8)
</code>

Serialization
--
    var buffer: ArrayBuffer = Struct.buffer(instance);
Deserialization
--
    var instance: Test = new Test(buffer);

Member function Example
------
    var Test = Struct.Create([
            {name: 'x', type: 'int8', val: 1},
            {name: 'y', type: 'int16', val: 2},
            {name: 'z', type: 'int32', val: 3},
            {name: 'w', type: 'float64', val: 4},
        ], {
            print: function(arg1: number) {
                console.log(this.x + this.y + this.z + this.w + arg1);
        }
    });
    var instance = new Test();
    instance.x = 3;
    instance.print(5); //prints  (3 + 2 + 3 + 4 + 5) = 17

Packing Example
--
    the above struct defined with packing 1, 2, 4, 8
    var Test1 = Struct.Create(..., {}, 1);
    var Test2 = Struct.Create(..., {}, 2);
    var Test4 = Struct.Create(..., {}, 4);
    var Test8 = Struct.Create(..., {}, 8);

    console.log(Test1.size == 15);
    console.log(Test2.size == 16);
    console.log(Test4.size == 16);
    console.log(Test8.size == 16);

    console.log(Test4.offsetof('x') == 0)
    console.log(Test4.offsetof('y') == 2)
    console.log(Test4.offsetof('z') == 4)
    console.log(Test4.offsetof('w') == 8)

More Examples
--
    var Test = Struct.Create([
        {name: 'x', type: 'char[2]', val: "ab"},
        {name: 'y', type: 'int[2]', val: [2, 3]},
        {name: 'z', type: 'ushort[3]', val: Struct.ArrayOf('ushort', 3)}
    ]);
    var TestEmbedded = Struct.Create([
        {name: 'arrTest', type: 'struct[2]', val: Struct.ArrayOf(Test, 2)},
        {name: 'anotherArr', type: 'struct[2]', val: [new Test(), new Test()]}
    ])

Member Access
--
Members can be simply accessed or assigned as any other property of the object

Dynamic Array memmber
--
    Motivation
    C++ Example
    struct Test {
        int num;
        char[1] data;
    }
    Test* mem = (Test*)malloc(sizeof(Test) + 49);
    mem->num = 50;
    char buffer[50] = "<your favourite buffer>";
    memcpy(mem->data, buffer, 50);

    on the typescript side
    var Test = Struct.Create([
        {name: 'num', type: 'int', val: 0},
        {name: 'data', type: 'char[*]', val: []}
    ])

    var instance = new Test(<received buff>);
    console.log(instance.data.length == 50);

    if the dynamic type is char[*] then the type of member created is string
    otherwise for any other type the typed array is created for native type liek Uint8Array, Int8Array and so on
    for struct type Struct[] type is created

    Note
    --
    The dynamic size member can only be the last member of the structure and the type of dynamic member should not contain any other dynamic size member

    For more examples see Test.ts file

API
--
    export declare class Struct {
        [key: string]: any;
        assign(namedVal: {[key: string]: any} | ArrayBuffer): void;
        static size: number;
        static sizeof(obj: typeof Struct | Struct): number;
        static offsetof(member: string): number | undefined;
        static CreateMatchHeader(includeMember: {[key: string]: any}): ArrayBuffer;
        static ArrayOf(type: string | typeof Struct, numElem: number): any[];
        static buffer(obj: Struct): ArrayBuffer;
        static Create(mems: MemberDefinition[], memfns?: MemberFunctionObject, packing?: number): typeof Struct;
    }
Supported Native Member Types
---
    char, int8, uint8,
    int16, short uint16, ushort,
    int32, uint32, int, uint
    float32, float64. float, double

License
--
    MIT
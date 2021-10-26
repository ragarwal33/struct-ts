import {Struct} from './struct';

var assertVal = function (str: string, cond: boolean) {
    if (cond) {
        console.log("PASSED: Testing " + str);
    }
    else {
        console.log("FAILED: Testing " + str);
    }
}
function RunFunctionTest() {
    var Test = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ], {
        sum: function(arg1: number) {
            var thisArg: any = this;
            return (thisArg.x + thisArg.y + thisArg.z + thisArg.w + arg1);
        }
    });
    var instance = new Test();
    instance.x = 3;
    assertVal("Function Test", instance.sum(5) == 17); //prints  (3 + 2 + 3 + 4 + 5) = 17
}
function RunPackingTest() {
    var Test1 = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ], {}, 1);
    var Test2 = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ], {}, 2);
    var Test4 = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ], {}, 4);
    var Test8 = Struct.Create([
        {name: 'x', type: 'int8', val: 1},
        {name: 'y', type: 'int16', val: 2},
        {name: 'z', type: 'int32', val: 3},
        {name: 'w', type: 'float64', val: 4},
    ], {}, 8);
    console.log(`Padding 1 size ${Test1.size}`);
    console.log(`Padding 2 size ${Test2.size}`);
    console.log(`Padding 4 size ${Test4.size}`);
    console.log(`Padding  size ${Test8.size}`);
}
function RunStructTest() {
    //compile structure definition
    var TestStrDArr = Struct.Create([
            { name: 'str', type: 'char[2]', val: Struct.ArrayOf('int8', 2) },
            { name: 'd1', type: 'double[1]', val: [2.0] },
    ]);

    //create structure variable
    var strTest = new TestStrDArr({ str: "ho" });
    var strTest1 = new TestStrDArr(Struct.buffer(strTest));
    assertVal("Check string ", strTest.str === strTest1.str);
    assertVal("Check array member", strTest.d1[0] === strTest1.d1[0]);

    ///////////////////////////////////////////////////////////////
    //Test Embedded structure
    var Test = Struct.Create([
            { name: 'c1', type: 'int8', val: 3 },
            { name: 'd1', type: 'double[1]', val: [2.0] },
    ], {
        print: function () {
            console.log("d1 " + this.d1 + " c1 " + this.c1);
        }
    });
    var matchHeader = Test.CreateMatchHeader({ c1: 2 });
    {
        var sz = Test.size;
        var instance = new Test({ d1: [5], c1: 4 });

        console.log("Check member function call");
        instance.print();
        instance.d1 = [8.9];
        instance.c1 = 46;
        var buff = Struct.buffer(instance);
        var newInstance = new Test(buff);

        assertVal("Check int8", instance.c1 === newInstance.c1);
        assertVal("Check array member", instance.d1[0] === newInstance.d1[0]);
    }

    var Test1 = Struct.Create([
            { name: 't', type: 'struct[2]', val: [new Test({ d1: [5], c1: 6 }), new Test({ d1: [6], c1: 7 })] },
    ]);
    {
        var sz1 = Test1.size;
        var instance1 = new Test1();
        instance1.t[0].d1 = [9];
        instance1.t[1].d1 = [89];
        var buff1 = Struct.buffer(instance1);
        var newInstance1 = new Test1(buff1);

        assertVal("Test embedded structure ", instance1.t[0].d1 === newInstance1.t[0].d1);
        assertVal("Test embedded structure ", instance1.t[1].d1 === newInstance1.t[1].d1);

    }
    /////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////
    //Test Packing
    var icd = Struct.Create([
        { name: 'ivar', type: 'int', val: 4 },
        { name: 'cvar', type: 'int8', val: 1 },
        { name: 'dvar', type: 'double', val: 3.5 }
    ], {}, 2);
    {
        var sz = icd.size;
        var offivar = icd.offsetof('ivar');
        var offcvar = icd.offsetof('cvar');
        var offdvar = icd.offsetof('dvar');

        assertVal("Test Packing 2: Offset of ivar", offivar === 0);
        assertVal("Test Packing 2: Offset of cvar", offcvar === 4);
        assertVal("Test Packing 2: Offset of dvar", offdvar === 6);
        assertVal("Test Packing 2: struct size", sz === 14);
    }

    var t1 = Struct.Create([
        { name: 'dvar', type: 'double', val: 3.5 },
        { name: 'cvar', type: 'int8', val: 1 },
    ], {}, 4);
    var t2 = Struct.Create([
        { name: 'cvar', type: 'int8', val: 1 },
        { name: 't12', type: 'struct[2]', val: Struct.ArrayOf(t1, 2) },
    ], {}, 8);

    sz = t1.size;
    assertVal("Test Packing 4: Offset of dvar", t1.offsetof('dvar') === 0);
    assertVal("Test Packing 4: Offset of cvar", t1.offsetof('cvar') === 8);
    assertVal("Test Packing 4: struct size", Struct.sizeof(t1) === 12);

    sz = Struct.sizeof(t1);
    sz = t2.size;
    var o1 = t2.offsetof('cvar');
    var o2 = t2.offsetof('t12');
    var t = new t2({ t12: Struct.ArrayOf(t1, 2) });
    assertVal("Test Packing 8: Offset of cvar", t2.offsetof('cvar') === 0);
    assertVal("Test Packing 8: Offset of t12", t2.offsetof('t12') === 4);
    assertVal("Test Packing 8: struct size", Struct.sizeof(t2) === 28);
    /////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////
    //Test dynamic length structure
    var dynamicStruct = Struct.Create([
        { name: 'cvar', type: 'int8', val: 2 },
        { name: 'arr', type: 'double[*]', val: [2.3] }
    ]);
    var ins = new dynamicStruct();
    sz = Struct.sizeof(ins);
    assertVal("Test dynamic structure: struct size before insert", Struct.sizeof(ins) === 16);

    buff = Struct.buffer(ins);
    var newins = new dynamicStruct(buff);
    ins.arr.push(5.6);
    sz = Struct.sizeof(ins);
    assertVal("Test dynamic structure: struct size after insert", Struct.sizeof(ins) === 24);
    newins = new dynamicStruct(Struct.buffer(ins));

    assertVal("Test dynamic structure: check array value 0", newins.arr[1] === 5.6);
    assertVal("Test dynamic structure: check array value 1", newins.arr[0] === 2.3);
    //////////////////////////////////////////////////////////////////////
}
RunFunctionTest();
RunPackingTest();
RunStructTest();
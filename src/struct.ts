var TypedArr = {
    char: [Int8Array, 1],
    int8: [Int8Array, 1],
    uint8: [Uint8Array, 1],
    int16: [Int16Array, 2],
    short: [Int16Array, 2],
    uint16: [Uint16Array, 2],
    ushort: [Int16Array, 2],
    int32: [Int32Array, 4],
    uint32: [Uint32Array, 4],
    int: [Int32Array, 4],
    uint: [Uint32Array, 4],
    float32: [Float32Array, 4],
    float64: [Float64Array, 8],
    float: [Float32Array, 4],
    double: [Float64Array, 8],
};
export type MemberFn = (...args: any[])=>any;
export interface MemberFunctionObject {
    [key: string]: MemberFn;
}

var extractTypeInfo = function(type: string) : {type: string, sz: number, arr: boolean}
{
    var regex = /(\w+)\[(\*|\d+)\]/g;
    var t = type;
    var arrSz = 1;
    var match = regex.exec(type);
    if (match !== null && match.length === 3) {
        t = match[1];
        if (match[2] === "*")
            arrSz = -1;
        else
            arrSz = parseInt(match[2]);
        return { type: t, sz: arrSz, arr: true };
    }
    return { type: t, sz: 1, arr: false };
}
var typeSize = function(type: string, isArr: boolean, val: any, forMaxSz: boolean): number {
    var sz = 0;
    if(isRegisteredStruct(type)) {
        if(forMaxSz)
            sz = (isArr ? val[0].__struct__.alignSize : val.__struct__.alignSize);
        else
            sz = (isArr ? val[0].__struct__.size : val.__struct__.size);
    }
    else {
        sz = (<any>TypedArr)[type][1];
    }
    return sz;
}
var GetSize = function (val: any, mem: MemberDefinition, forMaxSz?: boolean): number {
    forMaxSz = (forMaxSz !== undefined ? forMaxSz : false);
    var typeInfo = extractTypeInfo(mem.type);
    var t = typeInfo.type;
    var arrSz = typeInfo.sz;
    var isArr = typeInfo.arr;
    var sz = typeSize(t, isArr, val, forMaxSz);

    if (forMaxSz)
        arrSz = 1;
    if (arrSz === -1)
        arrSz = val.length;
    return sz * arrSz;
}

var serializeArrayMember = function (buff: Uint8Array, val: any, isArray: boolean, arrSz: number): void {
    if(isArray)
    {
        var minSize = Math.min(val.length, arrSz);
        if (typeof (val) === 'string') {
            for (var i = 0; i < minSize; ++i) {
                buff[i] = val.charCodeAt(i);
            }
        }
        else {
            for (var i = 0; i < minSize; ++i) {
                buff[i] = val[i];
            }
        }
    }
    else {
        buff[0] = val;
    }
}
var serializeStructBuffer = function(val: any, isArr: boolean, arrSz: number): ArrayBuffer {
    if (!isArr)
        return Struct.buffer(val);
    else {
        var buffSize = arrSz * val[0].__struct__.size;
        var buff = new ArrayBuffer(buffSize);
        var off = 0;
        for(var i = 0; i < arrSz; ++i)
        {
            var valBuff = Struct.buffer(val[i]);
            off += copyBuffer(buff, off, valBuff, valBuff.byteLength);
        }
        return buff;
    }
}

var serializeMember = function (mem: MemberDefinition, val: any): ArrayBuffer {
    var buff = null;
    var typeInfo = extractTypeInfo(mem.type);
    var t = typeInfo.type;
    var arrSz = typeInfo.sz;
    if (arrSz === -1)
        arrSz = val.length;
    var isArr = typeInfo.arr;
    if(isRegisteredStruct(t))
        return serializeStructBuffer(val, isArr, arrSz);
    else {
        buff = new (<any>TypedArr)[t][0](arrSz);
        serializeArrayMember(buff, val, isArr, arrSz);
        return buff.buffer;
    }
}
var deSerializeArrayMember = function (buff: Uint8Array, isArray: boolean, type: string, arrSz: number): any {
    if (isArray) {
        if (type === 'char') {
            //put the result in string
            var str = "";
            for(var i = 0; i < buff.length; ++i){
                var c = buff[i];
                if(c === 0)
                    break;
                str += String.fromCharCode(c);
            }
            return str;
        }
        else if(type == 'uint8') {
            return buff;
        }
        else {
            var arr = [];
            for (var i = 0; i < arrSz; ++i) {
                arr.push(buff[i]);
            }
            return arr;
        }
    }
    else {
        return buff[0];
    }
}
var deSerializeStructBuffer = function (ab: ArrayBuffer, off: number, val: any, isArr: boolean, arrSz: number): number {
    if (!isArr)
        return deserialize(ab, off, val);
    else {
        var offset = 0;
        for (var i = 0; i < arrSz; ++i) {
            if(val.length <= i) {
                var defaultVal = new val[0].__struct__();
                val.push(defaultVal);
            }
            offset += deserialize(ab, off + offset, val[i]);
        }
        return offset;
    }
}
var deSerializeMember = function (ab: ArrayBuffer, off: number, obj: any, mem: MemberDefinition): void {
    var buff = null;
    var typeInfo = extractTypeInfo(mem.type);
    var t = typeInfo.type;
    var arrSz = typeInfo.sz;
    if (arrSz === -1) {
        //determine sizeof array according to size remaining in buffer and array element size
        arrSz = (ab.byteLength - off) / typeSize(t, typeInfo.arr, mem.val, false);
    }
    var isArr = typeInfo.arr;
    if(isRegisteredStruct(t)){
        deSerializeStructBuffer(ab, off, obj[mem.name], isArr, arrSz);
    }
    else {
        if(off % (<any>TypedArr)[t][1] == 0)
            buff = new (<any>TypedArr)[t][0](ab, off, arrSz);
        else {
            let buff1 = ab.slice(off, off + arrSz * (<any>TypedArr)[t][1]);
            buff = new (<any>TypedArr)[t][0](buff1, 0, arrSz);
        }
        obj[mem.name] = deSerializeArrayMember(buff, isArr, t, arrSz);
    }
}
var copyBuffer = function (dest: ArrayBuffer, off: number, src: ArrayBuffer, len: number): number {
    var uint8Dst = new Uint8Array(dest, off);
    var uint8Src = new Uint8Array(src);
    for (var i = 0; i < len; ++i) {
        uint8Dst[i] = uint8Src[i];
    }
    return uint8Src.length;
}
var appendBuffer = function (buff: ArrayBuffer, typedArr: any, val?: any ): ArrayBuffer {
    var arrayBuf = null;
    if (Object.prototype.toString.call(typedArr) === "[object ArrayBuffer]") {
        arrayBuf = typedArr;
    } else {
        var arr = new typedArr(val.length);
        for (var i = 0; i < val.length; ++i)
            arr[i] = val[i];
        arrayBuf = arr.buffer;
    }
    var newBuff = new ArrayBuffer(buff.byteLength + arrayBuf.byteLength);
    copyBuffer(newBuff, 0, buff, buff.byteLength);
    copyBuffer(newBuff, buff.byteLength, arrayBuf, arrayBuf.byteLength);
    return newBuff;
}
var serializeForMatchHeader = function (struct: any, includeMember: {[key: string]: boolean}): ArrayBuffer {
    var buff = new ArrayBuffer(0);
    var mems = struct.mems;
    var sz = struct.size;

    var lastFilled = 0;
    buff = appendBuffer(buff, TypedArr['uint8'][0], [struct.dynamic ? 1 : 0]);
    buff = appendBuffer(buff, TypedArr['uint8'][0], [(sz & 0xff), (sz >> 8)]);

    for (var i = 0; i < mems.length; ++i) {
        var mem = mems[i];
        var memOff = mem.off;
        //skip padding bytes
        buff = appendBuffer(buff, TypedArr['uint8'][0], [memOff - lastFilled]);

        if (includeMember.hasOwnProperty(mem.name)) {
            var val = includeMember[mem.name];
            var size = GetSize(val, mem, false);
            var membuff = serializeMember(mem, val);
            buff = appendBuffer(buff, TypedArr['uint8'][0], [1, (size & 0xff), (size >> 8)]);
            buff = appendBuffer(buff, membuff);
        }
        else {
            var size = GetSize(mem.val, mem, false);
            //skip size bytes
            buff = appendBuffer(buff, TypedArr['uint8'][0], [0, (size & 0xff), (size >> 8)]);
        }
        lastFilled = memOff + size;
    }
    return buff;
}

var serialize = function (obj: Struct): ArrayBuffer {
    var struct = (<any>obj).__struct__;
    var sz = Struct.sizeof(obj);

    var buff = new ArrayBuffer(sz);
    var mems = struct.mems;

    for (var i = 0; i < mems.length; ++i) {
        var mem = mems[i];
        var val = (<any>obj)[mem.name];
        var memOff = mem.off;
        var membuff = serializeMember(mem, val);
        copyBuffer(buff, memOff, membuff, membuff.byteLength);
    }
    return buff;
}
var deserialize = function (ab: ArrayBuffer, off: number, obj: any): number {
    var struct = obj.__struct__;
    var sz = struct.size;
    var mems = struct.mems;

    for (var i = 0; i < mems.length; ++i) {
        var mem = mems[i];
        deSerializeMember(ab, off + mem.off, obj, mem);
    }
    return sz;
}
var isRegisteredStruct = function(type: string): boolean {
    var regex = /^struct\d+$/;
    return regex.test(type)
}
var isCompatibleArray = function (val: any, type: string, arrSz: number): boolean {
    var typeCheck = false;
    switch(type)
    {
        case 'char':
        case 'int8':
        case 'uint8':
            {
                if (typeof (val) == 'string' || val instanceof Array)
                {
                    //TODO: Check elements if instance of Array
                    typeCheck = true;
                }
                else
                {
                    //check if typed array
                    var proto = Object.prototype.toString.call(val);
                    if (proto === '[object Int8Array]' || proto === '[object UInt8Array]')
                        typeCheck = true;
                    //decide incase other type should also be treated as this type
                }
                break;
            }
        case 'short':
        case 'ushort':
        case 'int16':
        case 'uint16':
            {
                if (val instanceof Array) {
                    //TODO: Check elements if instance of Array
                    typeCheck = true;
                }
                else {
                    //check if typed array
                    var proto = Object.prototype.toString.call(val);
                    if (proto === '[object Int16Array]' || proto === '[object UInt16Array]' ||
                        proto === '[object Int8Array]' || proto === '[object UInt8Array]')
                        typeCheck = true;
                    //decide incase other type should also be treated as this type
                }
                break;
            }
        case 'int':
        case 'uint':
        case 'int32':
        case 'uint32':
            {
                if (val instanceof Array) {
                    //TODO: Check elements if instance of Array
                    typeCheck = true;
                }
                else {
                    //check if typed array
                    var proto = Object.prototype.toString.call(val);
                    if (proto === '[object Int32Array]' || proto === '[object UInt32Array]' ||
                        proto === '[object Int16Array]' || proto === '[object UInt16Array]' ||
                        proto === '[object Int8Array]' || proto === '[object UInt8Array]')
                        typeCheck = true;
                    //decide incase other integer type should also be convertible to char/int8/uint8
                }
                break;
            }
        case 'float32':
        case 'float64':
        case 'float':
        case 'double':
            {
                if (val instanceof Array) {
                    //TODO: Check elements if instance of Array
                    typeCheck = true;
                }
                else {
                    //check if typed array
                    var proto = Object.prototype.toString.call(val);
                    if (proto === '[object Float32Array]' || proto === '[object Float64Array]' ||
                        proto === '[object Int32Array]' || proto === '[object UInt32Array]' ||
                        proto === '[object Int16Array]' || proto === '[object UInt16Array]' ||
                        proto === '[object Int8Array]' || proto === '[object UInt8Array]')
                        typeCheck = true;
                    //decide incase other integer type should also be convertible to char/int8/uint8
                }
                break;
            }
        default: {
            if(isRegisteredStruct(type) && val instanceof Array) {
                //it may be registered struct type
                for(let i = 0; i < val.length; ++i) {
                    var struct = (<any>val[i]).__struct__;
                    if(!struct || struct.type !== type)
                        throw new Error(`Struct of type ${type} required at index ${i} in the provided array`);
                }
                typeCheck = true;
            }
            break;
        }
    }
    if (!(arrSz == -1 || arrSz == val.length || (type == 'char' && typeof(val) === 'string' && arrSz >= val.length))) {
        typeCheck = false;
    }
    return typeCheck;
}
var isCompatibleValue = function (val: any, type: string): boolean {
    var typeCheck = false;
    switch(type)
    {
        case 'char':
        case 'int8':
        case 'uint8':
            {
                if (typeof (val) == 'string' && val.length == 1 || (typeof(val) == 'number' && val < 256)) {
                    typeCheck = true;
                }
                break;
            }
        case 'short':
        case 'ushort':
        case 'int16':
        case 'uint16':
        case 'int':
        case 'uint':
        case 'int32':
        case 'uint32':
        case 'float32':
        case 'float64':
        case 'float':
        case 'double':
            {
                if (typeof(val) == 'number') {
                    typeCheck = true;
                }
                break;
            }
        default: {
            if(isRegisteredStruct(type)) {
                var struct = (<any>val).__struct__;
                if(!struct || struct.type !== type)
                    throw new Error(`Struct of type ${type} required`);
                typeCheck = true;
            }
            break;
        }
    }
    return typeCheck;
}
var checkMember = function(val: any, mem: MemberDefinition): void {
    var type = mem.type;
    //verify type of the value
    var typeInfo = extractTypeInfo(type);
    var t = typeInfo.type;
    var arrSz = typeInfo.sz;
    var isArr = typeInfo.arr;
    if (isArr) {
        var b = isCompatibleArray(val, t, arrSz);
        if(!b)
            throw new Error("member type mismatch");
    }
    else {
        var b = isCompatibleValue(val, t);
        if(!b)
            throw new Error("member type mismatch");
    }
}
var checkStructMembers = function (namedVal: {[key: string]: any}, obj: Struct): boolean {
    var struct = (<any>obj).__struct__;
    var def = struct.def;
    var keys = Object.keys(namedVal);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];

        if (!def.hasOwnProperty(key)) {
            throw new Error("member " + key  + " not found");
        }
        var val = namedVal[key];
        var mem = def[key];
        checkMember(val, mem);
    }
    return true;
};
var assignMembers = function (namedVal: {[key: string]: any}, obj: Struct): void {
    if (checkStructMembers(namedVal, obj)) {
        var keys = Object.keys(namedVal);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            (<any>obj)[key] = namedVal[key];
        }
    }
}
var adjustOffset = function (off: number, sz: number, packing: number): number {
    //start of member should be aligned to its size or packing which ever is minimum
    var min = Math.min(packing, sz);
    var intPart = ~~(off / min);
    var remPart = off % min;
    if (remPart !== 0) {
        intPart += 1;
    }
    return intPart * min;
}
var buildOffset = function (mems: MemberDefinition[], packing: number): { size: number, alignSize: number, dynamic: boolean } {
    var off = 0;
    var maxSz = 0;
    var dynamic = false;
    for (var i = 0; i < mems.length; ++i) {
        var mem = mems[i];
        var typeInfo = extractTypeInfo(mem.type);
        if (typeInfo.sz === -1 && i < mems.length - 1)
            throw new Error("Variable size array can only come at the end of the struct");
        if (typeInfo.sz === -1)
            dynamic = true;

        var sz = GetSize(mem.val, mem, true);
        if (sz > maxSz)
            maxSz = sz;
        mem.off = adjustOffset(off, sz, packing);
        mem.sz = GetSize(mem.val, mem);
        off = mem.off + mem.sz;
    }
    var off = adjustOffset(off, maxSz, packing);
    var min = Math.min(maxSz, packing);
    return { size: off, alignSize: min, dynamic: dynamic };
}

var isPackingValid = function(packing: number): boolean
{
    var valid = [1, 2, 4, 8, 16];
    var validPacking = (valid.indexOf(packing) != -1);
    return validPacking;
}
var structSetup = function(obj1: Struct, packing?: number): void
{
    var obj: any = obj1;
    packing = (packing === undefined ? 8 : packing);
    var validPacking = isPackingValid(packing);
    if (!validPacking)
        throw new Error("Not a valid packing");

    obj.packing = packing;
    var o = buildOffset(obj.mems, obj.packing);
    obj.size = o.size;
    obj.alignSize = o.alignSize;
    obj.dynamic = o.dynamic;
}
export interface MemberDefinition {
    name: string                        //member name
    type: keyof(typeof TypedArr) | any;/*to support the array eg. char[16] or char[*]*/
    val: any;                           //initial value
    off?: number;
    sz?: number;
}

export class Struct {
    [key: string]: any;
    constructor(initialzationArgs?: {[key: string]: any} | ArrayBuffer, obj?: any){
        for (var i = 0; i < obj.mems.length; ++i) {
            var m = obj.mems[i].name;
            (<any>this)[m] = obj.mems[i].val;
        }
        this.assign(initialzationArgs);
    }
    assign(namedVal?: {[key: string]: any} | ArrayBuffer): void {
        var structObj: any = this;
        var struct = structObj.__struct__;
        if (struct === undefined || !(struct.prototype instanceof Struct))
            throw new Error("Not a struct type");

        if (Object.prototype.toString.call(namedVal) === "[object ArrayBuffer]")
            this.read(<ArrayBuffer>namedVal, 0);
        else if (namedVal !== undefined)
            assignMembers(namedVal, structObj);
    };
    read(ab: ArrayBuffer, off: number): void {
        var structObj: any = this;
        var struct = structObj.__struct__;
        if (struct === undefined || !(struct.prototype instanceof Struct))
            throw new Error("Not a struct type");

        deserialize(ab, off, structObj);
    };
    protected static unique: number = 0;
    static size: number = 0;
    static get type(): string {return ""};   //type of the struct
    static sizeof(obj: typeof Struct | Struct): number {
        let structObj: any = obj;
        if (structObj.prototype instanceof Struct)
            return structObj.size;

        var struct = structObj.__struct__;

        if (struct === undefined || !(struct.prototype instanceof Struct))
            throw new Error("Not a struct type");

        if (!struct.dynamic)
            return struct.size;
        else {
            var lastMem = struct.mems[struct.mems.length - 1];
            var typeInfo = extractTypeInfo(lastMem.type);
            var t = typeInfo.type;
            var arrSz = typeInfo.sz;
            var sz = lastMem.off + structObj[lastMem.name].length * typeSize(t, typeInfo.arr, structObj[lastMem.name], false);
            sz = adjustOffset(sz, struct.alignSize, struct.alignSize);
            return sz;
        }
    }
    static offsetof(member: string): number {return -1;}
    static CreateMatchHeader(includeMember: {[key: string]: any}): ArrayBuffer {return <any>null;}
    static ArrayOf(type: string | typeof Struct, numElem: number): any[] {
        if (typeof (type) === 'string') {
            if(TypedArr.hasOwnProperty(type)) {
                var arr = [];
                for (var i = 0; i < numElem; ++i) {
                    arr.push(0);
                }
                return arr;
            }
            else {
                throw new Error("Unknown type");
            }
        }
        else if ((<any>type).prototype instanceof Struct) {
            var arr = [];
            for (var i = 0; i < numElem; ++i) {
                arr.push(new (<any>type)());
            }
            return arr;
        }
        throw new Error("Type is not struct type");
    };
    static buffer(obj: Struct): ArrayBuffer {
        let structObj: any = obj;
        var struct = structObj.__struct__;
        if (struct === undefined || !(struct.prototype instanceof Struct))
            throw new Error("Not a struct type");

        return serialize(structObj);
    };
    static Create(mems: MemberDefinition[], memfns?: MemberFunctionObject, packing?: number): typeof Struct {
        //Check if we were supplied valid intial values for the members
        for (var i = 0; i < mems.length; ++i) {
            checkMember(mems[i].val, mems[i]);
        }

        if (typeof (memfns) !== 'object' && typeof (packing) === 'undefined') {
            packing = memfns;
            memfns = undefined;
        }
        class NamedStruct extends Struct {
            private static uniqueName = "struct" + (++Struct.unique);
            static get mems(): MemberDefinition[] {return mems};
            static get type(): string {return NamedStruct.uniqueName};
            static def = (function () {
                var def: {[key: string]: MemberDefinition} = {};
                for (var i = 0; i < mems.length; ++i) {
                    var mem = mems[i];
                    var m = mem.name;
                    if (def.hasOwnProperty(m))
                        throw new Error("Member already Exists");
                    if (mem.val === undefined)
                        throw new Error("Default value is required and type should be convertible to its member type");
                    def[m] = mem;
                    //TODO: Check no dynamic structure allowed inside a dynamic structure
                }
                return def;
            })();

            constructor(init_args: any) {
                super(init_args, NamedStruct);
            }
            static offsetof(member: string): number {
                if (NamedStruct.def.hasOwnProperty(member))
                    return <number>NamedStruct.def[member].off;
                else
                    return -1;
            }
            static CreateMatchHeader(includeMember: {[key: string]: boolean}): ArrayBuffer {
                return serializeForMatchHeader(NamedStruct, includeMember);
            }
        }
        (<any>NamedStruct.prototype).__struct__ = NamedStruct;

        structSetup(<any>NamedStruct, packing);
        if (memfns !== undefined) {
            var keys = Object.keys(memfns);
            for (var i = 0; i < keys.length; ++i) {
                (<any>NamedStruct.prototype)[keys[i]] = memfns[keys[i]];
            }
        }

        return NamedStruct;
    };
}

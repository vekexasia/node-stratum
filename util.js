var crypto = require('crypto');

var binpack = require('binpack');
var base58 = require('base58-native');
var bignum = require('bignum');


exports.bignumFromBits = function(bitsString){
    var bitsBuff = new Buffer(bitsString, 'hex');
    var numBytes = bitsBuff.readUInt8(0);
    var bigBits = bignum.fromBuffer(bitsBuff.slice(1));
    var target = bigBits.mul(
        bignum(2).pow(
            bignum(8).mul(
                numBytes - 3
            )
        )
    );
    return target;
};

exports.bignumFromTarget = function(targetString){
  return bignum.fromBuffer(new Buffer(targetString, 'hex'));
};

exports.doublesha = function(buffer){
    var hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    hash1 = hash1.digest();

    var hash2 = crypto.createHash('sha256');
    hash2.update(hash1);
    hash2 = hash2.digest();

    return hash2;
};

exports.reverseBuffer = function(buff){
    var reversed = new Buffer(buff.length);
    for (var i = buff.length - 1; i >= 0; i--)
        reversed[buff.length - i - 1] = buff[i];
    return reversed;
};

exports.reverseHex = function(hex){
    return exports.reverseBuffer(new Buffer(hex, 'hex')).toString('hex');
};

exports.reverseByteOrder = function(buff){
    for (var i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return exports.reverseBuffer(buff);
};

exports.uint256BufferFromHash = function(hex){

    var fromHex = new Buffer(hex, 'hex');

    if (fromHex.length != 32){
        var empty = new Buffer(32);
        empty.fill(0);
        fromHex.copy(empty);
        fromHex = empty;
    }

    return exports.reverseBuffer(fromHex);
};

exports.hexFromReversedBuffer = function(buffer){
    return exports.reverseBuffer(buffer).toString('hex');
};

exports.varIntBuffer = function(n){
    if (n < 0xfd)
        return new Buffer([n]);
    else if (n < 0xffff){
        var buff = new Buffer(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    }
    else if (n < 0xffffffff){
        var buff = new Buffer(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    }
    else{
        var buff = new Buffer(9);
        buff[0] = 0xff;
        binpack.packUInt64(n, 'little').copy(buff, 1);
        return buff;
    }
};

exports.serializeNumber = function(n){
    if (n < 0xfd){
        var buff = new Buffer(2);
        buff[0] = 0x1;
        buff.writeUInt8(n, 1);
        return buff;
    }
    else if (n <= 0xffff){
        var buff = new Buffer(4);
        buff[0] = 0x3;
        buff.writeUInt16LE(n, 1);
        return buff;
    }
    else if (n <= 0xffffffff){
        var buff = new Buffer(5);
        buff[0] = 0x4;
        buff.writeUInt32LE(n, 1);
        return buff;
    }
    else{
        return Buffer.concat([new Buffer([0x9]), binpack.packUInt64(n, 'little')]);
    }
};

exports.serializeString = function(s){

    if (s.length < 253)
        return Buffer.concat([
            new Buffer([s.length]),
            new Buffer(s)
        ]);
    else if (s.length < 0x10000)
        return Buffer.concat([
            new Buffer([253]),
            binpack.packUInt16(s.length, 'little'),
            new Buffer(s)
        ]);
    else if (s.length < 0x100000000)
        return Buffer.concat([
            new Buffer([254]),
            binpack.packUInt32(s.length, 'little'),
            new Buffer(s)
        ]);
    else
        return Buffer.concat([
            new Buffer([255]),
            binpack.packUInt64(s.length),
            new Buffer(s)
        ]);
};

exports.range = function(start, stop, step){
    if (typeof stop === 'undefined'){
        stop = start;
        start = 0;
    }
    if (typeof step === 'undefined'){
        step = 1;
    }
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)){
        return [];
    }
    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step){
        result.push(i);
    }
    return result;
};

exports.address_to_pubkeyhash = function(addr){
    addr = base58.decode(addr);

    if (addr.length != 25){
        console.log('invalid address length for ' + addr);
        throw 'invalid address length';
    }

    if (!addr)
        return null;

    var ver = addr[0];
    var cksumA = addr.slice(-4);
    var cksumB = exports.doublesha(addr.slice(0, -4)).slice(0, 4);

    if (cksumA.toString('hex') != cksumB.toString('hex'))
        throw 'checksum did not match';

    return [ver, addr.slice(1,-4)];
};

exports.script_to_pubkey = function(key){
    if (key.length === 66) key = new Buffer(key, 'hex');
    if (key !== 33) throw 'Invalid address';
    var pubkey = new Buffer(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    key.copy(pubkey, 1);
    return pubkey;
};

exports.script_to_address = function(addr){
    var d = exports.address_to_pubkeyhash(addr)
    if (!d)
        throw "invalid address";

    var ver = d[0];
    var pubkeyhash = d[1];
    return Buffer.concat([new Buffer([0x76, 0xa9, 0x14]), pubkeyhash, new Buffer([0x88, 0xac])]);
};


/*
exports.makeBufferReadable = function(buffer){
    var position = 0;
    buffer.read = function(length){
        var section = buffer.slice(position, length ? (position + length) : buffer.length);
        position += length;
        return MakeBufferReadable(section);
    }
    return buffer;
};


exports.ser_uint256 = function(u){
    var rs = new Buffer(0);
    exports.range(8).forEach(function(i){
        rs = Buffer.concat([
            rs,
            binpack.packUInt32(u & 0xFFFFFFFF, 'little')
        ]);
        u >>= 32;
    });
    return rs;
};

exports.deser_uint256 = function(f){
    var r = 0;
    exports.range(8).forEach(function(i){
        var t = f.read(4).readUInt32LE(4);
        r += t << (i * 32);
    });
    return r;
};

exports.uint256_from_compact = function(c){
    var nbytes = (c >> 24) & 0xFF;
    v = (c & 0xFFFFFF) << (8 * (nbytes - 3))
    return v;
};

exports.uint256_from_str = function(s){
    var r = 0;
    var t = binpack.unpack
};

exports.ser_uint256_be = function(u){
    var rs = new Buffer(0);
    exports.range(8).forEach(function(i){
        rs = Buffer.concat([
            rs,
            binpack.packUInt32(u & 0xFFFFFFFF, 'big')
        ]);
        u >>= 32;
    });
    return rs;
};

exports.deser_string = function(f){
    var nit = f.read(1).readUInt8(0);
    if (nit == 253)
        nit = f.read(2).readUInt16LE(0);
    else if (nit == 254)
        nit = f.read(4).readUInt32LE(1);
    else if (nit == 255)
        nit = f.read(8).readUInt64LE(1);
    return f.read(nit);
};


exports.ser_vector = function(l){
    var r;
    if (l.length < 253)
        r = new Buffer([l.length]);
    else if (l.length < 0x10000)
        r = Buffer.concat([new Buffer([253]), binpack.packUInt16(l.length, 'little')]);
    else if (l.length < 0x100000000)
        r = Buffer.concat([new Buffer([254]), binpack.packUInt32(l.length, 'little')]);
    else
        r = Buffer.concat([new Buffer([255]), binpack.packUInt64(l.length, 'little')]);

    l.forEach(function(i){
        r = Buffer.concat([r, i.serialize()]);
    });

    return r;
};

exports.deser_vector = function(f, c){
    var nit = f.read(1).readUInt8(0);
    if (nit == 253)
        nit = f.read(2).readUInt16LE(0);
    else if (nit == 254)
        nit = f.read(4).readUInt32LE(0);
    else if (nit == 255)
        nit = f.read(8).readUInt64LE(0);
    var r = [];
    exports.range(nit).forEach(function(i){
        var t = new c();
        t.deserialize(f);
        r.push(t);
    });
    return r;
};
 */


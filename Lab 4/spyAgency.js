"use strict";

// تثبيت المكتبة: npm install blind-signatures
let blindSignatures = require("blind-signatures");
let BigInteger = require("jsbn").BigInteger;
let rand = require("./rand.js");

const COPIES_REQUIRED = 10;

class SpyAgency {
  constructor() {
    this.key = blindSignatures.keyGeneration({ b: 2048 }); // إنشاء مفتاح بطول 2048 بت
  }

  // ✅ التحقق من أن التعتيم يعمل بشكل صحيح
  consistent(blindHash, factor, hash) {
    let n = new BigInteger(this.key.keyPair.n.toString());
    let e = new BigInteger(this.key.keyPair.e.toString());

    if (!blindHash || !factor || !hash) {
      console.error(`❌ خطأ: إحدى القيم المطلوبة مفقودة في consistent()`);
      return false;
    }

    blindHash = new BigInteger(blindHash.toString());
    let bigHash = new BigInteger(hash, 16);
    let calculatedBlindHash = bigHash.multiply(factor.modPow(e, n)).mod(n);

    console.log(`🔍 مقارنة البصمات في consistent():`);
    console.log(`📌 البصمة المعتمة الأصلية  : ${blindHash}`);
    console.log(`📌 البصمة المحسوبة بعد تطبيق التعتيم: ${calculatedBlindHash}`);

    return blindHash.equals(calculatedBlindHash);
  }

  // ✅ التحقق من صحة المستند الأصلي والمعلومات المرتبطة به
  verifyContents(blindHash, blindingFactor, originalDoc) {
    console.log(`\n📝 التحقق من المستند: ${originalDoc}`);

    if (
      !originalDoc.match(
        /^The bearer of this signed document, .*, has full diplomatic immunity.$/
      )
    ) {
      console.log(`❌ فشل التحقق: نص المستند غير صحيح!`);
      return false;
    }

    let computedHash = blindSignatures.messageToHash(originalDoc);
    console.log(`🔢 البصمة المحسوبة من المستند: ${computedHash}`);

    if (!this.consistent(blindHash, blindingFactor, computedHash)) {
      console.log(`❌ فشل التحقق: التوقيع لا يتطابق مع عامل التعتيم`);
      return false;
    }

    console.log(`✅ المستند اجتاز التحقق بنجاح!`);
    return true;
  }

  // ✅ تنفيذ توقيع المستندات
  signDocument(blindDocs, response) {
    if (blindDocs.length !== COPIES_REQUIRED) {
      throw new Error(
        `❌ يجب تقديم ${COPIES_REQUIRED} مستندات، ولكن استلمت ${blindDocs.length} فقط.`
      );
    }

    blindDocs = blindDocs.slice();
    let selected = rand.nextInt(blindDocs.length);
    console.log(`🏛️ الوكالة اختارت توقيع المستند رقم: ${selected}`);

    if (!blindDocs[selected]) {
      throw new Error(`❌ لا يوجد مستند مختار للتوقيع!`);
    }

    return response(selected, (blindingFactors, originalDocs) => {
      for (let i = 0; i < blindDocs.length; i++) {
        if (i === selected) continue;

        console.log(`🔍 التحقق من المستند ${i} قبل توقيعه...`);
        if (!this.verifyContents(blindDocs[i], blindingFactors[i], originalDocs[i])) {
          throw new Error(`❌ المستند ${i} غير صالح!`);
        }
      }

      console.log(`✅ كل المستندات اجتازت التحقق، سيتم توقيع المستند رقم ${selected}`);

      return blindSignatures.sign({
        blinded: blindDocs[selected],
        key: this.key,
      });
    });
  }

  get n() {
    return this.key.keyPair.n.toString();
  }

  get e() {
    return this.key.keyPair.e.toString();
  }
}

exports.SpyAgency = SpyAgency;

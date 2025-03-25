"use strict";

let blindSignatures = require("blind-signatures");
let BigInteger = require("jsbn").BigInteger;
let SpyAgency = require("./spyAgency.js").SpyAgency;

// ✅ دالة إنشاء المستندات
function makeDocument(coverName) {
  return `The bearer of this signed document, ${coverName}, has full diplomatic immunity.`;
}

// ✅ دالة التعتيم (Blinding)
function blind(msg, n, e) {
  console.log(`🔢 التعتيم: N=${n}, E=${e}`);

  let blindedData = blindSignatures.blind({
    message: msg,
    N: new BigInteger(n.toString()),
    E: new BigInteger(e.toString()),
  });

  console.log(`📜 المستند بعد التعتيم:`, blindedData.blinded.toString());
  return blindedData;
}

// ✅ دالة فك التعتيم (Unblinding)
function unblind(blindingFactor, sig, n) {
  if (!blindingFactor || !sig) {
    console.error(`❌ خطأ: البيانات المطلوبة لفك التعتيم مفقودة!`);
    return null;
  }
  return blindSignatures.unblind({
    signed: sig,
    N: new BigInteger(n.toString()),
    r: blindingFactor,
  });
}

// ✅ إنشاء كائن وكالة التجسس
let agency = new SpyAgency();

// ✅ إنشاء أسماء العملاء والمستندات
let coverNames = [
  "Agent Alpha",
  "Agent Bravo",
  "Agent Charlie",
  "Agent Delta",
  "Agent Echo",
  "Agent Foxtrot",
  "Agent Golf",
  "Agent Hotel",
  "Agent India",
  "Agent Juliet",
];

let documents = coverNames.map(makeDocument);
let blindDocs = [];
let blindingFactors = [];

// ✅ تنفيذ عملية التعتيم لكل مستند
documents.forEach((doc, index) => {
  let { blinded, r } = blind(doc, agency.n, agency.e);

  console.log(`📄 مستند أصلي [${index}]:`, doc);
  console.log(`🔒 مستند معتم [${index}]:`, blinded.toString());
  console.log(`🔑 عامل التعتيم [${index}]:`, r.toString());

  blindDocs.push(blinded);
  blindingFactors.push(r);
});

// ✅ إرسال المستندات إلى الوكالة للتوقيع
agency.signDocument(blindDocs, (selected, verifyAndSign) => {
  console.log(`🏛️ الوكالة اختارت توقيع المستند رقم: ${selected}`);

  let factorsToSend = blindingFactors.map((factor, index) =>
    index === selected ? undefined : factor
  );

  let docsToSend = documents.map((doc, index) =>
    index === selected ? undefined : doc
  );

  let blindedSignature = verifyAndSign(factorsToSend, docsToSend);

  if (!blindedSignature) {
    throw new Error(`❌ التوقيع المعتم غير موجود!`);
  }

  // ✅ فك التعتيم بعد التوقيع
  let unblindedSignature = unblind(blindingFactors[selected], blindedSignature, agency.n);

  if (!unblindedSignature) {
    throw new Error(`❌ التوقيع بعد فك التعتيم غير موجود!`);
  }

  console.log(`🔓 التوقيع بعد فك التعتيم:`, unblindedSignature.toString());

  // ✅ التحقق من صحة التوقيع
  let isValid = blindSignatures.verify({
    unblinded: unblindedSignature,
    N: new BigInteger(agency.n.toString()),
    E: new BigInteger(agency.e.toString()),
    message: documents[selected],
  });

  console.log(`✅ التوقيع صالح: ${isValid}`);
});

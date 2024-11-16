const _litActionCode = async () => {
    try {

        const apiKey = await Lit.Actions.decryptAndCombine({
            accessControlConditions,
            ciphertext,
            dataToEncryptHash,
            authSig: null,
            chain: "baseSepolia",
          });

          const messages = [
          {
            role: "system",
            content:
              "You are an AI assistant that helps people make informed blockchain trading decisions. Only answer with a single sentence.",
          },
          {
            role: "user",
            content: `${openAiPrompt}`,
          },
        ];

          const responseInf = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
              }),
            }
          );
  
          const resultInf = await responseInf.json();
          const answer = resultInf.choices[0].message.content;






        Lit.Actions.setResponse({response:answer})
    } catch (error) {
        Lit.Actions.setResponse({ response: error.message });
    }
  }
  
  export const litActionCode = `(${_litActionCode.toString()})();`;
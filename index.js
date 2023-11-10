const axios = require('axios');
const express = require('express');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, doc, setDoc, Timestamp } = require("firebase/firestore");
const app = express();
const handlebars = require("express-handlebars").engine;
const translate = require('translate-google');

const firebaseConfig = {
  apiKey: "AIzaSyAhDJ2wal_dDzObcCVwLNQ0isguUG6sj40",
  authDomain: "integrandoapi.firebaseapp.com",
  projectId: "integrandoapi",
  storageBucket: "integrandoapi.appspot.com",
  messagingSenderId: "234671094131",
  appId: "1:234671094131:web:89d8b7434dd3abde18ed06"
};

// Initialize Firebase
const DBinitialize = initializeApp(firebaseConfig);
const DB = getFirestore();

app.engine("handlebars", handlebars({ defaultLayout: "main" }))
app.set("view engine", "handlebars")

app.get("/", async function (req, res) {
  const cocktailNamePT = req.query.cocktailName;

  try {
    // Traduzir a consulta de pesquisa de pt para en
    const cocktailNameEN = await translate(cocktailNamePT, { from: 'pt', to: 'en' });

    const response = await axios.get('https://api.api-ninjas.com/v1/cocktail', {
      params: { name: cocktailNameEN },
      headers: {
        'X-Api-Key': 'XWyZ4Neg4kiCu8gZwtajNQ==C3yVN95xGWduUVdS'
      }
    });

    const cocktails = response.data;

    // Traduzir os ingredientes de cada coquetel
    const translatedCocktails = await Promise.all(cocktails.map(async cocktail => {
      const translatedIngredients = await translate(cocktail.ingredients, { from: 'en', to: 'pt' });
      const translatedInstructions = await translate(cocktail.instructions, { from: 'en', to: 'pt' });

      // Adicione a lógica de gravação no banco de dados
      const searchId = generateUniqueId(); // Gere um identificador único para a pesquisa
      await saveToFirebase(searchId, cocktail.name, translatedIngredients, translatedInstructions, cocktailNamePT);

      return {
        name: cocktail.name,
        translatedIngredients: Array.isArray(translatedIngredients) ? translatedIngredients : [translatedIngredients],
        translatedInstructions: translatedInstructions
      };
    }));

    // Renderize a página "cocktail.handlebars" com os detalhes
    res.render("cocktail", { cocktails: translatedCocktails });
  } catch (error) {
    console.error('Request failed:', error);

    // Renderize a página com uma mensagem de erro
    res.render("cocktail", { error: 'Erro ao buscar coquetéis.' });
  }
});

app.listen(8081, function () {
  console.log("Ativo")
});

// Função para gerar um identificador único
function generateUniqueId() {
  return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

// Função para salvar no banco de dados Firebase
async function saveToFirebase(searchId, name, ingredients, instructions,cocktailNamePT) {
  try {
    // Crie uma subcoleção chamada "Searches" dentro da coleção "Cocktail"
    const cocktailRef = doc(DB, "Cocktail", searchId);

    await setDoc(cocktailRef, {
      pesquisa: cocktailNamePT,
      timestamp: Timestamp.now() // Adicione um timestamp para ordenação
    });
    const searchRef = collection(cocktailRef, "pesquisa");

    // Crie um documento dentro da subcoleção "Searches" para cada pesquisa
    await setDoc(doc(searchRef, searchId), {
      nome: name,
      ingrediente: ingredients,
      instrucao: instructions
    });

    console.log("Dados gravados no Firebase com sucesso!");
  } catch (e) {
    console.error("Erro ao gravar no Firebase:", e);
  }
}

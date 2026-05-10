const Pet = require('../models/Pet')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const mongoose = require('mongoose')

const getToken = require('../helpers/get-tokens')
const getUserByToken = require('../helpers/get-user-by-token')
const { countDocuments } = require('../models/User')

module.exports = class PetController {
    static async create(req, res) {
        const { name, age, weight, color } = req.body

        if (!name) {
            res.status(422).json({ message: 'O nome é obrigatório!' })
            return
        }

        if (!age) {
            res.status(422).json({ message: 'A idade é obrigatória!' })
            return
        }

        if (!weight) {
            res.status(422).json({ message: 'O peso é obrigatório!' })
            return
        }

        if (!color) {
            res.status(422).json({ message: 'A cor é obrigatória!' })
            return
        }

        if (!req.files || req.files.length === 0) {
            res.status(422).json({ message: 'A imagem é obrigatória!' })
            return
        }

        const images = req.files.map((file) => file.filename)

        const token = getToken(req)
        const user = await getUserByToken(token)

        const pet = new Pet({
            name,
            age,
            weight,
            color,
            image: images,
            available: true,
            user: {
                _id: user._id,
                name: user.name,
                image: user.image,
                phone: user.phone,
            },
        })

        try {
            const newPet = await pet.save()
            res.status(201).json({
                message: 'Pet cadastrado com sucesso!',
                data: newPet,
            })
        } catch (error) {
            res.status(503).json({ message: error })
        }

    }
    static async getAll(req, res) {
        const pets = await Pet.find().sort('-createdAt')

        res.status(200).json({
            success: true,
            count: pets.length,
            data: pets,
        })
        return
    }
    static async getAllUserPets(req, res) {
        const token = getToken(req)
        const user = await getUserByToken(token)

        const pets = await Pet.find({ 'user._id': user._id }).sort('-createdAt')

        res.status(200).json({
            success: true,
            count: pets.length,
            data: pets,
        })
        return
    }
    static async getAllUserAdoptions(req, res) {
        const token = getToken(req)
        const user = await getUserByToken(token)

        const pets = await Pet.find({ 'adopter._id': user._id }).sort('-createdAt')

        res.status(200).json({
            success: true,
            count: pets.length,
            data: pets,
        })
        return
    }
    static async getPetById(req, res) {
        const id = req.params.id

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(422).json({ message: 'O id do pet é obrigatório!' })
            return
        }

        try {
            const pet = await Pet.findById(id)
            if (!pet) {
                res.status(404).json({ message: 'Pet não encontrado!' })
                return
            }
            res.status(200).json({ success: true, data: pet })

        } catch (error) {
            res.status(503).json({ message: error })
        }

        const pet = await Pet.findById(id)

        if (!pet) {
            res.status(404).json({ message: 'Pet não encontrado!' })
            return
        }

        res.status(200).json({ data: pet })
    }
    static async removePetById(req, res) {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(422).json({ message: 'O id do pet é obrigatório!' })
            return
        }

        const pet = await Pet.findById(id)

        if (!pet) {
            res.status(404).json({ message: 'Pet não encontrado!' })
            return
        }

        const token = getToken(req)
        const user = await getUserByToken(token)

        if (pet.user._id.toString() !== user._id.toString()) {
            res.status(403).json({ message: 'Apenas o dono do pet pode removê-lo!' })
            return
        }

        await Pet.findByIdAndDelete(id)

        res.status(200).json({ message: 'Pet removido com sucesso!' , data: pet})


    }
    static async updatePet(req, res) {
        const {name, age, weight, color} = req.body
        const id = req.params.id
        const images = req.files
        const updateData = {}

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(422).json({ message: 'O id do pet é obrigatório!' })
            return
        }

        const pet = await Pet.findById(id)
        if (!pet) {
            res.status(404).json({ message: 'Pet não encontrado!' })
            return
        }

        const token = getToken(req)
        const user = await getUserByToken(token)

        if (pet.user._id.toString() !== user._id.toString()) {
            res.status(403).json({ message: 'Apenas o dono do pet pode editá-lo!' })
            return
        }

        if (name) {
            updateData.name = name
        }
        if (age) {
            updateData.age = age
        }
        if (weight) {
            updateData.weight = weight
        }
        if (color) {
            updateData.color = color
        }
        if (images && images.length > 0) {
            updateData.image = images.map((file) => file.filename)
        }

        await Pet.findByIdAndUpdate(id, updateData, { new: true })
        res.status(200).json({ message: 'Pet atualizado com sucesso!', data: updateData })
    }
    static async schedule(req, res) {
        const id = req.params.id

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(422).json({ message: 'O id do pet é inválido' })
            return
        }

        const pet = await Pet.findById(id)

        if (!pet) {
            res.status(404).json({ message: 'Pet não encontrado!' })
            return
        }

        const token = getToken(req)
        const user = await getUserByToken(token)

        if (pet.user._id.toString() === user._id.toString()) {
            res.status(403).json({ message: 'Você não pode agendar uma visita com seu próprio pet!' })
            return
        }

        pet.adopter = {
            _id: user._id,
            name: user.name,
            image: user.image
        }

        try {
            await Pet.findByIdAndUpdate(id, pet)
            return res.status(200).json({ message: 'Visita agendada com sucesso!' })
        } catch (error) {
            return res.status(503).json({ message: error })
        }
    }
    static async concludeAdoption(req, res) {
       const id = req.params.id

       if (!mongoose.Types.ObjectId.isValid(id)) {
           res.status(422).json({ message: 'O id do pet é inválido' })
           return
       }

         const pet = await Pet.findById(id)

         if (!pet) {
             res.status(404).json({ message: 'Pet não encontrado!' })
             return
         }

            const token = getToken(req)
            const user = await getUserByToken(token)

            if (pet.user._id.toString() !== user._id.toString()) {
                res.status(403).json({ message: 'Acesso Negado' })
                return
            }

            pet.available = false

            try {
                await Pet.findByIdAndUpdate(id, pet)
                return res.status(200).json({ message: 'Adoção concluída com sucesso!' })
            } catch (error) {
                return res.status(503).json({ message: error })
            }    
    }
}